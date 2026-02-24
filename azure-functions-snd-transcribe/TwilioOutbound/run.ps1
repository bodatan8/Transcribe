using namespace System.Net

param($Request, $TriggerMetadata)

function Parse-BodyMap {
    param($body)
    $map = @{}
    if ($null -eq $body) { return $map }
    if ($body -is [System.Collections.IDictionary]) {
        foreach ($k in $body.Keys) { $map[[string]$k] = $body[$k] }
        return $map
    }
    $raw = ""
    if ($body -is [byte[]]) {
        $raw = [System.Text.Encoding]::UTF8.GetString($body)
    } else {
        $raw = [string]$body
    }
    if ([string]::IsNullOrWhiteSpace($raw)) { return $map }
    try {
        $obj = $raw | ConvertFrom-Json -ErrorAction Stop
        if ($obj -is [System.Collections.IDictionary]) {
            foreach ($k in $obj.Keys) { $map[[string]$k] = $obj[$k] }
            return $map
        }
        foreach ($p in $obj.PSObject.Properties) {
            $map[$p.Name] = $p.Value
        }
        return $map
    } catch {
        foreach ($pair in $raw -split '&') {
            if ([string]::IsNullOrWhiteSpace($pair)) { continue }
            $parts = $pair -split '=', 2
            $key = [System.Uri]::UnescapeDataString($parts[0].Replace('+', ' '))
            $value = if ($parts.Count -gt 1) { [System.Uri]::UnescapeDataString($parts[1].Replace('+', ' ')) } else { "" }
            $map[$key] = $value
        }
    }
    return $map
}

function Get-CorsHeaders {
    param($RequestObject)
    $origin = [string]$RequestObject.Headers.Origin
    $allowedOrigins = @("https://localhost", "capacitor://localhost")
    $allowOrigin = if ($allowedOrigins -contains $origin) { $origin } else { "https://localhost" }
    return @{
        "Access-Control-Allow-Origin"  = $allowOrigin
        "Access-Control-Allow-Methods" = "POST, OPTIONS"
        "Access-Control-Allow-Headers" = "Content-Type, x-app-secret"
        "Access-Control-Max-Age"       = "86400"
        "Vary"                         = "Origin"
    }
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

$corsHeaders = Get-CorsHeaders -RequestObject $Request
if ($Request.Method -eq "OPTIONS") {
    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::NoContent
        Headers    = $corsHeaders
    })
    return
}

try {
    $sharedSecret = $env:APP_API_SHARED_SECRET
    if ($sharedSecret) {
        $providedSecret = $Request.Headers.'x-app-secret'
        if (-not $providedSecret -or $providedSecret -ne $sharedSecret) {
            throw "Unauthorized"
        }
    }

    $payload = Parse-BodyMap -body $Request.Body

    $toNumber = $payload.to_number
    $fromNumber = if ($payload.from_number) { $payload.from_number } else { $env:TWILIO_NUMBER }
    $userId = $payload.user_id
    $contactId = $payload.contact_id

    if (-not $toNumber -or -not $fromNumber) {
        throw "Missing to_number or from_number"
    }

    $twilioSid = $env:TWILIO_ACCOUNT_SID
    $twilioToken = $env:TWILIO_AUTH_TOKEN
    if (-not $twilioSid -or -not $twilioToken) {
        throw "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN"
    }

    $callbackBase = Get-RequestHostUrl -RequestObject $Request
    $statusCallback = "$callbackBase/api/twilio/status"
    $recordingCallback = "$callbackBase/api/twilio/recording"

    $authHeader = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$twilioSid`:$twilioToken"))
    $apiHeaders = @{ Authorization = "Basic $authHeader" }

    $form = @{
        To                      = $toNumber
        From                    = $fromNumber
        Url                     = "https://twimlets.com/echo?Twiml=%3CResponse%3E%3CSay%20voice%3D%22alice%22%3EConnecting%20your%20call.%3C%2FSay%3E%3C%2FResponse%3E"
        StatusCallback          = $statusCallback
        StatusCallbackMethod    = "POST"
        RecordingStatusCallback = $recordingCallback
        RecordingStatusCallbackMethod = "POST"
        Record                  = "true"
    }

    $twilioResponse = Invoke-RestMethod -Method Post `
        -Uri "https://api.twilio.com/2010-04-01/Accounts/$twilioSid/Calls.json" `
        -Headers $apiHeaders `
        -Body $form `
        -ContentType "application/x-www-form-urlencoded" `
        -ErrorAction Stop

    $callRow = @{
        provider          = "twilio"
        provider_call_sid = $twilioResponse.sid
        direction         = "outbound"
        from_number       = $fromNumber
        to_number         = $toNumber
        status            = $twilioResponse.status
        started_at        = (Get-Date).ToString("o")
        metadata          = @{
            twilio_outbound = $twilioResponse
        }
    }
    if ($userId) { $callRow["user_id"] = $userId }
    if ($contactId) { $callRow["contact_id"] = $contactId }

    if ($userId) {
        $null = Invoke-Supabase -Method "POST" -Path "calls" -Body @($callRow)
    }

    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::OK
        Headers    = $corsHeaders
        Body       = @{
            call_sid = $twilioResponse.sid
            status   = $twilioResponse.status
        }
    })
} catch {
    $errMessage = $_.Exception.Message
    $twilioStatus = $null
    $twilioDetail = $null
    try {
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $twilioDetail = [string]$_.ErrorDetails.Message
        }
        $resp = $_.Exception.Response
        if ($resp) {
            $twilioStatus = [int]$resp.StatusCode
            $stream = $resp.GetResponseStream()
            if ($stream) {
                $reader = [System.IO.StreamReader]::new($stream)
                $streamText = $reader.ReadToEnd()
                if ($streamText) { $twilioDetail = $streamText }
            }
        }
    } catch {
        # Keep original exception message when response parsing fails.
    }
    $status = if ($_.Exception.Message -eq "Unauthorized") { [HttpStatusCode]::Unauthorized } else { [HttpStatusCode]::BadRequest }
    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = $status
        Headers    = $corsHeaders
        Body       = @{
            error = $errMessage
            twilio_status = $twilioStatus
            twilio_error = $twilioDetail
        }
    })
}
