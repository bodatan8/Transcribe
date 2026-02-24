using namespace System.Net
using namespace System.Text
using namespace System.Security.Cryptography

param($Request, $TriggerMetadata)

function To-Base64Url {
    param([byte[]]$bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
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

function New-TwilioAccessToken {
    param(
        [string]$AccountSid,
        [string]$ApiKeySid,
        [string]$ApiKeySecret,
        [string]$Identity,
        [string]$TwimlAppSid,
        [string]$PushCredentialSid
    )
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $exp = $now + 3600

    $header = @{
        typ = "JWT"
        alg = "HS256"
        cty = "twilio-fpa;v=1"
    }

    $voiceGrant = @{
        incoming = @{ allow = $true }
        outgoing = @{ application_sid = $TwimlAppSid }
    }
    if ($PushCredentialSid) {
        $voiceGrant.push_credential_sid = $PushCredentialSid
    }
    $grants = @{
        identity = $Identity
        voice    = $voiceGrant
    }

    $payload = @{
        jti    = "$ApiKeySid-$now"
        iss    = $ApiKeySid
        sub    = $AccountSid
        exp    = $exp
        grants = $grants
    }

    $headerJson = ($header | ConvertTo-Json -Compress)
    $payloadJson = ($payload | ConvertTo-Json -Compress -Depth 10)
    $headerEncoded = To-Base64Url -bytes ([Text.Encoding]::UTF8.GetBytes($headerJson))
    $payloadEncoded = To-Base64Url -bytes ([Text.Encoding]::UTF8.GetBytes($payloadJson))
    $toSign = "$headerEncoded.$payloadEncoded"

    $hmac = [HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($ApiKeySecret))
    $signature = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign))
    $signatureEncoded = To-Base64Url -bytes $signature

    return "$toSign.$signatureEncoded"
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

    $body = $Request.Body
    $identity = if ($body.identity) { [string]$body.identity } else { "spratt-user" }

    $token = New-TwilioAccessToken `
      -AccountSid $env:TWILIO_ACCOUNT_SID `
      -ApiKeySid $env:TWILIO_API_KEY_SID `
      -ApiKeySecret $env:TWILIO_API_KEY_SECRET `
      -Identity $identity `
      -TwimlAppSid $env:TWILIO_TWIML_APP_SID `
      -PushCredentialSid $env:TWILIO_PUSH_CREDENTIAL_SID

    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::OK
        Headers    = $corsHeaders
        Body       = @{
            token = $token
        }
    })
} catch {
    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::BadRequest
        Headers    = $corsHeaders
        Body       = @{
            error = $_.Exception.Message
        }
    })
}
