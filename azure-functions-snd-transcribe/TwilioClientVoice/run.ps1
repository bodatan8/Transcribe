using namespace System.Net

param($Request, $TriggerMetadata)

function Parse-BodyMap {
    param($body)
    $map = @{}

    if ($null -eq $body) { return $map }

    if ($body -is [System.Collections.IDictionary]) {
        foreach ($k in $body.Keys) { $map[[string]$k] = [string]$body[$k] }
        return $map
    }

    if (($body -isnot [string]) -and ($body -isnot [byte[]]) -and $body.PSObject -and $body.PSObject.Properties) {
        foreach ($p in $body.PSObject.Properties) {
            if ($p.Name) { $map[[string]$p.Name] = [string]$p.Value }
        }
        if ($map.Count -gt 0) { return $map }
    }

    $raw = ""
    if ($body -is [byte[]]) {
        $raw = [System.Text.Encoding]::UTF8.GetString($body)
    } else {
        $raw = [string]$body
    }
    if ([string]::IsNullOrWhiteSpace($raw)) { return $map }

    foreach ($pair in $raw -split '&') {
        if ([string]::IsNullOrWhiteSpace($pair)) { continue }
        $parts = $pair -split '=', 2
        $key = [System.Uri]::UnescapeDataString($parts[0])
        $value = if ($parts.Count -gt 1) { [System.Uri]::UnescapeDataString($parts[1]) } else { "" }
        $map[$key] = $value
    }
    return $map
}

function Normalize-Destination {
    param([string]$value)
    if ([string]::IsNullOrWhiteSpace($value)) { return "" }
    $v = $value.Trim()
    if ($v -match '^\d+$') { return "+$v" }
    if ($v -match '^\s+\d+$') { return "+" + ($v.Trim()) }
    return $v
}

function Get-RawFormValue {
    param(
        [string]$raw,
        [string[]]$keys
    )
    if ([string]::IsNullOrWhiteSpace($raw)) { return "" }
    foreach ($k in $keys) {
        $pattern = "(?:^|&)$([Regex]::Escape($k))=([^&]*)"
        $m = [Regex]::Match($raw, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if ($m.Success) {
            $decoded = [System.Uri]::UnescapeDataString($m.Groups[1].Value)
            if (-not [string]::IsNullOrWhiteSpace($decoded)) { return $decoded }
        }
    }
    return ""
}

function Get-RequestHostUrl {
    param($RequestObject)
    $proto = if ($RequestObject.Headers.'x-forwarded-proto') { $RequestObject.Headers.'x-forwarded-proto' } else { 'https' }
    $hostName = if ($RequestObject.Headers.'x-forwarded-host') { $RequestObject.Headers.'x-forwarded-host' } else { $RequestObject.Headers.Host }
    return "${proto}://$hostName"
}

try {
    $toNumber = $null
    $bodyObj = $Request.Body
    $toCandidates = @(
        $Request.Query.To,
        $Request.Query.to,
        $Request.Query.to_number,
        $Request.Query.Called,
        $Request.Query.called,
        $bodyObj.To,
        $bodyObj.to,
        $bodyObj.to_number,
        $bodyObj.Called,
        $bodyObj.called
    )
    foreach ($candidate in $toCandidates) {
        if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
            $toNumber = [string]$candidate
            break
        }
    }
    $form = Parse-BodyMap -body $Request.Body
    if (-not $toNumber) {
        foreach ($k in @("To", "to", "to_number", "Called", "called")) {
            if ($form.ContainsKey($k) -and -not [string]::IsNullOrWhiteSpace([string]$form[$k])) {
                $toNumber = Normalize-Destination -value ([string]$form[$k])
                break
            }
        }
    }
    if (-not $toNumber) {
        $rawParsedTo = Get-RawFormValue -raw ([string]$Request.Body) -keys @("to", "To", "to_number", "Called", "called")
        if ($rawParsedTo) { $toNumber = Normalize-Destination -value $rawParsedTo }
    }
    $toNumber = Normalize-Destination -value $toNumber
    if (-not $toNumber) {
        throw "Missing destination number"
    }

    $baseUrl = Get-RequestHostUrl -RequestObject $Request
    $statusCallback = "$baseUrl/api/twilio/status"
    $fromNumber = if ($env:TWILIO_NUMBER) { $env:TWILIO_NUMBER } else { "" }
    $toEscaped = [System.Security.SecurityElement]::Escape([string]$toNumber)
    $twiml = @"
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="$fromNumber" answerOnBridge="true" record="record-from-answer-dual" action="$statusCallback" method="POST">
    <Number statusCallback="$statusCallback" statusCallbackMethod="POST">$toEscaped</Number>
  </Dial>
</Response>
"@

    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::OK
        Headers    = @{ "Content-Type" = "text/xml; charset=utf-8" }
        Body       = $twiml
    })
} catch {
    Write-Error "TwilioClientVoice failed: $($_.Exception.Message)"
    $twiml = @"
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We could not place your call right now.</Say>
  <Hangup />
</Response>
"@
    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::OK
        Headers    = @{ "Content-Type" = "text/xml; charset=utf-8" }
        Body       = $twiml
    })
}
