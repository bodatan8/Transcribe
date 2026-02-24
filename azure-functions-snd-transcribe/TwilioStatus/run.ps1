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

function Get-CallByProviderSid {
    param([string]$CallSid)
    if (-not $CallSid) { return $null }
    $encodedSid = [System.Uri]::EscapeDataString($CallSid)
    $rows = Invoke-Supabase -Method "GET" -Path "calls?provider_call_sid=eq.$encodedSid&select=id,user_id,recording_id&limit=1"
    if ($rows -is [System.Array]) {
        if ($rows.Count -gt 0) { return $rows[0] }
        return $null
    }
    return $rows
}

function To-TwilioIdentity {
    param([string]$email)
    if (-not $email) { return "" }
    return ($email -replace '[^a-zA-Z0-9_-]', '_')
}

function Resolve-UserIdByClientIdentity {
    param([string]$Identity)
    if (-not $Identity) { return $null }
    $rows = Invoke-Supabase -Method "GET" -Path "profiles?select=id,email&limit=200"
    $items = if ($rows -is [System.Array]) { $rows } else { @($rows) }
    foreach ($row in $items) {
        $candidate = To-TwilioIdentity -email ([string]$row.email)
        if ($candidate -eq $Identity) { return [string]$row.id }
    }
    return $null
}

function Normalize-Phone {
    param([string]$value)
    if (-not $value) { return "" }
    $v = $value.Trim()
    if ($v -match '^\d+$') { return "+$v" }
    return $v
}

function Ensure-CallByProviderSid {
    param(
        [string]$CallSid,
        [string]$CallStatus,
        [hashtable]$Form
    )
    if (-not $CallSid) { return $null }
    $existing = Get-CallByProviderSid -CallSid $CallSid
    if ($existing) { return $existing }

    $fromRaw = if ($Form.ContainsKey("From")) { [string]$Form["From"] } elseif ($Form.ContainsKey("from")) { [string]$Form["from"] } else { "" }
    $callerRaw = if ($Form.ContainsKey("Caller")) { [string]$Form["Caller"] } elseif ($Form.ContainsKey("caller")) { [string]$Form["caller"] } else { "" }
    if (-not $fromRaw -and $callerRaw) { $fromRaw = $callerRaw }
    $toRaw = if ($Form.ContainsKey("To")) { [string]$Form["To"] } elseif ($Form.ContainsKey("to")) { [string]$Form["to"] } else { "" }
    $calledRaw = if ($Form.ContainsKey("Called")) { [string]$Form["Called"] } elseif ($Form.ContainsKey("called")) { [string]$Form["called"] } else { "" }
    if (-not $toRaw) { $toRaw = $calledRaw }

    $directionRaw = if ($Form.ContainsKey("Direction")) { [string]$Form["Direction"] } elseif ($Form.ContainsKey("direction")) { [string]$Form["direction"] } else { "inbound" }
    $isClientOrigin = $fromRaw -like "client:*"
    $direction = if ($isClientOrigin) { "outbound" } else { if ($directionRaw -like "*outbound*") { "outbound" } else { "inbound" } }

    $fromNumber = if ($isClientOrigin) { [string]$env:TWILIO_NUMBER } else { $fromRaw }
    $toNumber = $toRaw
    if (-not $fromNumber) { $fromNumber = [string]$env:TWILIO_NUMBER }
    if (-not $toNumber) { $toNumber = [string]$env:TWILIO_NUMBER }
    $fromNumber = Normalize-Phone -value $fromNumber
    $toNumber = Normalize-Phone -value $toNumber

    $userId = $null
    if ($isClientOrigin) {
        $clientSource = if ($fromRaw -like "client:*") { $fromRaw } else { $callerRaw }
        if (-not $clientSource -and $callerRaw) { $clientSource = $callerRaw }
        if ($clientSource -like "client:*") {
            $clientIdentity = $clientSource.Substring(7)
            $userId = Resolve-UserIdByClientIdentity -Identity $clientIdentity
        }
    }
    if (-not $userId) { $userId = [string]$env:DEFAULT_CALL_USER_ID }
    $payload = @{
        provider          = "twilio"
        provider_call_sid = $CallSid
        direction         = $direction
        from_number       = $fromNumber
        to_number         = $toNumber
        status            = if ($CallStatus) { $CallStatus } else { "initiated" }
        started_at        = (Get-Date).ToString("o")
        metadata          = @{
            twilio_status = $Form
        }
    }
    if ($userId) { $payload["user_id"] = $userId }
    $null = Invoke-Supabase -Method "POST" -Path "calls" -Body @($payload)
    return Get-CallByProviderSid -CallSid $CallSid
}

function Upload-TwilioRecordingToSupabase {
    param(
        [string]$RecordingSid,
        [string]$RecordingUrl,
        [string]$UserId
    )
    if (-not $RecordingUrl -or -not $UserId) { return $null }
    $supabaseUrl = $env:SUPABASE_URL
    $serviceKey = $env:SUPABASE_SERVICE_KEY
    $twilioSid = $env:TWILIO_ACCOUNT_SID
    $twilioToken = $env:TWILIO_AUTH_TOKEN
    if (-not $supabaseUrl -or -not $serviceKey -or -not $twilioSid -or -not $twilioToken) { return $null }

    $downloadUrl = if ($RecordingUrl -match '\.(mp3|wav)$') { $RecordingUrl } else { "$RecordingUrl.mp3" }
    $tmpFile = [System.IO.Path]::GetTempFileName()
    try {
        $twilioAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$twilioSid`:$twilioToken"))
        Invoke-WebRequest -Method Get -Uri $downloadUrl -Headers @{ Authorization = "Basic $twilioAuth" } -OutFile $tmpFile -ErrorAction Stop | Out-Null

        $objectPath = "$UserId/twilio-$RecordingSid.mp3"
        $uploadUrl = "$supabaseUrl/storage/v1/object/recordings/$objectPath"
        Invoke-WebRequest -Method Post -Uri $uploadUrl -Headers @{
            "apikey"        = $serviceKey
            "Authorization" = "Bearer $serviceKey"
            "x-upsert"      = "true"
        } -InFile $tmpFile -ContentType "audio/mpeg" -ErrorAction Stop | Out-Null

        return "$supabaseUrl/storage/v1/object/public/recordings/$objectPath"
    } finally {
        if (Test-Path $tmpFile) {
            Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
        }
    }
}

function Ensure-RecordingRowForCall {
    param(
        [string]$CallSid,
        [string]$RecordingSid,
        [string]$RecordingUrl
    )
    if (-not $CallSid -or -not $RecordingSid -or -not $RecordingUrl) { return $null }
    $callRow = Get-CallByProviderSid -CallSid $CallSid
    if (-not $callRow -or -not $callRow.user_id) { return $null }
    if ($callRow.recording_id) { return $callRow.recording_id }

    $audioUrl = Upload-TwilioRecordingToSupabase -RecordingSid $RecordingSid -RecordingUrl $RecordingUrl -UserId ([string]$callRow.user_id)
    if (-not $audioUrl) { return $null }

    $inserted = Invoke-Supabase -Method "POST" -Path "recordings" -Body @(
        @{
            user_id = $callRow.user_id
            audio_url = $audioUrl
            transcription_status = "processing"
        }
    )
    $recordingId = $null
    if ($inserted -is [System.Array]) {
        if ($inserted.Count -gt 0) { $recordingId = $inserted[0].id }
    } elseif ($inserted) {
        $recordingId = $inserted.id
    }
    if ($recordingId) {
        $encodedSid = [System.Uri]::EscapeDataString($CallSid)
        $null = Invoke-Supabase -Method "PATCH" -Path "calls?provider_call_sid=eq.$encodedSid" -Body @{
            recording_id = $recordingId
            updated_at = (Get-Date).ToString("o")
        }
    }
    return $recordingId
}

try {
    $form = Parse-FormBody -rawBody $Request.Body

    $callSid = if ($form.ContainsKey("CallSid")) { $form["CallSid"] } elseif ($form.ContainsKey("call_sid")) { $form["call_sid"] } else { $null }
    $callStatus = if ($form.ContainsKey("CallStatus")) { $form["CallStatus"] } elseif ($form.ContainsKey("call_status")) { $form["call_status"] } else { $null }
    $duration = if ($form.ContainsKey("CallDuration")) { $form["CallDuration"] } elseif ($form.ContainsKey("call_duration")) { $form["call_duration"] } else { $null }
    $recordingSid = if ($form.ContainsKey("RecordingSid")) { $form["RecordingSid"] } elseif ($form.ContainsKey("recording_sid")) { $form["recording_sid"] } else { $null }
    $recordingUrl = if ($form.ContainsKey("RecordingUrl")) { $form["RecordingUrl"] } elseif ($form.ContainsKey("recording_url")) { $form["recording_url"] } else { $null }
    $recordingStatus = if ($form.ContainsKey("RecordingStatus")) { $form["RecordingStatus"] } elseif ($form.ContainsKey("recording_status")) { $form["recording_status"] } else { $null }
    $timestamp = (Get-Date).ToString("o")

    if ($callSid) {
        $patch = @{
            status     = $callStatus
            updated_at = $timestamp
            metadata   = @{
                twilio_status = $form
            }
        }

        if ($duration) {
            $patch["duration_seconds"] = [int]$duration
        }

        if ($callStatus -eq "in-progress") {
            $patch["answered_at"] = $timestamp
        }
        if ($callStatus -in @("completed", "busy", "failed", "no-answer", "canceled")) {
            $patch["ended_at"] = $timestamp
        }
        if ($recordingSid) { $patch["recording_sid"] = $recordingSid }
        if ($recordingUrl) { $patch["recording_url"] = $recordingUrl }
        if ($recordingStatus) { $patch["recording_status"] = $recordingStatus }

        $callRow = Ensure-CallByProviderSid -CallSid $callSid -CallStatus $callStatus -Form $form
        $encodedSid = [System.Uri]::EscapeDataString($callSid)
        $null = Invoke-Supabase -Method "PATCH" -Path "calls?provider_call_sid=eq.$encodedSid" -Body $patch
        try {
            $null = Ensure-RecordingRowForCall -CallSid $callSid -RecordingSid $recordingSid -RecordingUrl $recordingUrl
        } catch {
            Write-Host "Ensure-RecordingRowForCall failed: $($_.Exception.Message)"
        }
    }

    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::OK
        Body       = "ok"
    })
} catch {
    Write-Error "TwilioStatus failed: $($_.Exception.Message)"
    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::InternalServerError
        Body       = "status webhook failed"
    })
}
