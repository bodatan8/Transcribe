using namespace System.Net
using namespace System.Text
using namespace System.Security.Cryptography

param($Request, $TriggerMetadata)

function Parse-FormBody {
    param([string]$rawBody)
    $map = @{}
    if ([string]::IsNullOrWhiteSpace($rawBody)) { return $map }
    foreach ($pair in $rawBody -split '&') {
        if ([string]::IsNullOrWhiteSpace($pair)) { continue }
        $parts = $pair -split '=', 2
        $k = [System.Uri]::UnescapeDataString($parts[0].Replace('+', ' '))
        $v = if ($parts.Count -gt 1) { [System.Uri]::UnescapeDataString($parts[1].Replace('+', ' ')) } else { "" }
        $map[$k] = $v
    }
    return $map
}

function Invoke-Supabase {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )
    $baseUrl = $env:SUPABASE_URL
    $serviceKey = $env:SUPABASE_SERVICE_KEY
    if (-not $baseUrl -or -not $serviceKey) {
        throw "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY"
    }

    $headers = @{
        "apikey"        = $serviceKey
        "Authorization" = "Bearer $serviceKey"
        "Content-Type"  = "application/json"
        "Prefer"        = "return=representation"
    }

    $params = @{
        Uri         = "$baseUrl/rest/v1/$Path"
        Method      = $Method
        Headers     = $headers
        ErrorAction = "Stop"
    }

    if ($null -ne $Body) {
        $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
    }

    return Invoke-RestMethod @params
}

function Get-RequestHostUrl {
    param($RequestObject)
    $proto = if ($RequestObject.Headers.'x-forwarded-proto') { $RequestObject.Headers.'x-forwarded-proto' } else { 'https' }
    $hostName = if ($RequestObject.Headers.'x-forwarded-host') { $RequestObject.Headers.'x-forwarded-host' } else { $RequestObject.Headers.Host }
    return "${proto}://$hostName"
}

try {
    $rawBody = ""
    if ($Request.Body) {
        if ($Request.Body -is [string]) {
            $rawBody = $Request.Body
        } else {
            $rawBody = [string]$Request.Body
        }
    }
    $form = Parse-FormBody -rawBody $rawBody

    $callSid = $form["CallSid"]
    $from = $form["From"]
    $to = $form["To"]
    $direction = if (($form["Direction"] -as [string]) -like "*inbound*") { "inbound" } else { "inbound" }
    $callStatus = if ($form["CallStatus"]) { $form["CallStatus"] } else { "ringing" }
    $defaultUserId = $env:DEFAULT_CALL_USER_ID

    if ($callSid -and $defaultUserId) {
        try {
            $null = Invoke-Supabase -Method "POST" -Path "calls?on_conflict=provider_call_sid" -Body @(
                @{
                    user_id            = $defaultUserId
                    provider           = "twilio"
                    provider_call_sid  = $callSid
                    direction          = $direction
                    from_number        = $from
                    to_number          = $to
                    status             = $callStatus
                    started_at         = (Get-Date).ToString("o")
                    metadata           = @{
                        twilio = $form
                    }
                }
            )
        } catch {
            # Do not block active call routing if persistence is unavailable.
            Write-Host "Supabase insert failed in TwilioInbound: $($_.Exception.Message)"
        }
    }

    $identity = if ($env:TWILIO_APP_CLIENT_IDENTITY) { $env:TWILIO_APP_CLIENT_IDENTITY } else { "spratt-user" }
    $fallback = $env:CALL_FALLBACK_E164
    $timeout = if ($env:CALL_RING_TIMEOUT_SECONDS) { [int]$env:CALL_RING_TIMEOUT_SECONDS } else { 15 }

    $actionBase = Get-RequestHostUrl -RequestObject $Request
    $dialAction = "$actionBase/api/twilio/status"

    $twiml = [StringBuilder]::new()
    [void]$twiml.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
    [void]$twiml.AppendLine('<Response>')
    [void]$twiml.AppendLine('  <Say voice="alice">Please wait while we connect your call.</Say>')
    [void]$twiml.AppendLine("  <Dial timeout=""$timeout"" answerOnBridge=""true"" record=""record-from-answer-dual"" action=""$dialAction"" method=""POST"">")
    [void]$twiml.AppendLine("    <Client>$identity</Client>")
    if ($fallback) {
        [void]$twiml.AppendLine("    <Number>$fallback</Number>")
    }
    [void]$twiml.AppendLine('  </Dial>')
    [void]$twiml.AppendLine('</Response>')

    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::OK
        Headers    = @{ "Content-Type" = "text/xml; charset=utf-8" }
        Body       = $twiml.ToString()
    })
} catch {
    Write-Error "TwilioInbound failed: $($_.Exception.Message)"
    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::InternalServerError
        Body       = "Inbound webhook failed"
    })
}
