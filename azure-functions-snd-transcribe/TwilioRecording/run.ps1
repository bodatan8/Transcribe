using namespace System.Net

param($Request, $TriggerMetadata)

function Parse-FormBody {
    param($rawBody)
    $map = @{}
    if ($null -eq $rawBody) { return $map }
    if ($rawBody -is [System.Collections.IDictionary]) {
        foreach ($k in $rawBody.Keys) { $map[[string]$k] = [string]$rawBody[$k] }
        return $map
    }
    if (($rawBody -isnot [string]) -and ($rawBody -isnot [byte[]]) -and $rawBody.PSObject -and $rawBody.PSObject.Properties) {
        foreach ($p in $rawBody.PSObject.Properties) {
            if ($p.Name) { $map[[string]$p.Name] = [string]$p.Value }
        }
        if ($map.Count -gt 0) { return $map }
    }
    $raw = if ($rawBody -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($rawBody) } else { [string]$rawBody }
    if ([string]::IsNullOrWhiteSpace($raw)) { return $map }
    foreach ($pair in $raw -split '&') {
        if ([string]::IsNullOrWhiteSpace($pair)) { continue }
        $parts = $pair -split '=', 2
        $k = [System.Uri]::UnescapeDataString($parts[0])
        $v = if ($parts.Count -gt 1) { [System.Uri]::UnescapeDataString($parts[1]) } else { "" }
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

try {
    $form = Parse-FormBody -rawBody $Request.Body

    $callSid = if ($form.ContainsKey("CallSid")) { $form["CallSid"] } elseif ($form.ContainsKey("call_sid")) { $form["call_sid"] } else { $null }
    $recordingSid = if ($form.ContainsKey("RecordingSid")) { $form["RecordingSid"] } elseif ($form.ContainsKey("recording_sid")) { $form["recording_sid"] } else { $null }
    $recordingUrl = if ($form.ContainsKey("RecordingUrl")) { $form["RecordingUrl"] } elseif ($form.ContainsKey("recording_url")) { $form["recording_url"] } else { $null }
    $recordingStatus = if ($form.ContainsKey("RecordingStatus")) { $form["RecordingStatus"] } elseif ($form.ContainsKey("recording_status")) { $form["recording_status"] } else { $null }

    if ($callSid) {
        $encodedSid = [System.Uri]::EscapeDataString($callSid)
        $null = Invoke-Supabase -Method "PATCH" -Path "calls?provider_call_sid=eq.$encodedSid" -Body @{
            recording_sid    = $recordingSid
            recording_url    = $recordingUrl
            recording_status = $recordingStatus
            updated_at       = (Get-Date).ToString("o")
            metadata         = @{
                twilio_recording = $form
            }
        }
    }

    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::OK
        Body       = "ok"
    })
} catch {
    Write-Error "TwilioRecording failed: $($_.Exception.Message)"
    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::InternalServerError
        Body       = "recording webhook failed"
    })
}
