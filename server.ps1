$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4173
$prefix = "http://localhost:$port/"
$settingsPath = Join-Path (Split-Path -Parent $root) "contact-mail-settings.json"
$defaultInquiryFolder = Join-Path $env:USERPROFILE "Desktop\网站询盘"

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
    ".txt"  = "text/plain; charset=utf-8"
}

function Get-ContentType {
    param([string]$Path)
    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    if ($mimeTypes.ContainsKey($extension)) {
        return $mimeTypes[$extension]
    }
    return "application/octet-stream"
}

function Resolve-RequestPath {
    param([string]$RawPath)

    $localPath = [System.Uri]::UnescapeDataString($RawPath.Split("?")[0]).TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($localPath)) {
        $localPath = "index.html"
    }

    $candidate = Join-Path $root ($localPath -replace "/", "\")
    if ((Test-Path $candidate) -and (Get-Item $candidate).PSIsContainer) {
        $candidate = Join-Path $candidate "index.html"
    }

    if (-not [System.IO.Path]::GetExtension($candidate)) {
        $candidate = "$candidate.html"
    }

    $fullRoot = [System.IO.Path]::GetFullPath($root)
    $fullPath = [System.IO.Path]::GetFullPath($candidate)

    if (-not $fullPath.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Invalid path."
    }

    return $fullPath
}

function Write-JsonResponse {
    param(
        [Parameter(Mandatory = $true)] $Context,
        [Parameter(Mandatory = $true)] [int] $StatusCode,
        [Parameter(Mandatory = $true)] $Payload
    )

    $json = $Payload | ConvertTo-Json -Depth 6 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = "application/json; charset=utf-8"
    $Context.Response.ContentLength64 = $buffer.Length
    $Context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
}

function Read-RequestBody {
    param($Request)

    $encoding = if ($Request.ContentEncoding) { $Request.ContentEncoding } else { [System.Text.Encoding]::UTF8 }
    $reader = [System.IO.StreamReader]::new($Request.InputStream, $encoding)
    try {
        return $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }
}

function Get-ContactSettings {
    if (-not (Test-Path $settingsPath)) {
        return $null
    }

    return Get-Content -Path $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Test-EmailSettingsReady {
    param($Settings)

    if (-not $Settings) {
        return $false
    }

    foreach ($field in @("smtpServer", "smtpPort", "smtpUsername", "smtpPassword", "fromEmail", "toEmail")) {
        if ([string]::IsNullOrWhiteSpace([string]$Settings.$field)) {
            return $false
        }
    }

    return $true
}

function ConvertTo-InquiryRecord {
    param($Payload)

    return [PSCustomObject]@{
        SubmittedAt          = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        FullName             = [string]$Payload.fullName
        CompanyName          = [string]$Payload.companyName
        EmailAddress         = [string]$Payload.emailAddress
        WhatsApp             = [string]$Payload.whatsApp
        Country              = [string]$Payload.country
        BusinessType         = [string]$Payload.businessType
        ProductInterest      = [string]$Payload.productInterest
        EstimatedQuantity    = [string]$Payload.estimatedQuantity
        NeedCustomLogo       = [string]$Payload.needCustomLogo
        PackagingRequirement = [string]$Payload.packagingRequirement
        Message              = [string]$Payload.message
    }
}

function Save-InquiryRecord {
    param(
        [Parameter(Mandatory = $true)] $Record,
        [Parameter(Mandatory = $true)] [string] $FolderPath
    )

    New-Item -ItemType Directory -Path $FolderPath -Force | Out-Null

    $csvPath = Join-Path $FolderPath "website-inquiries.csv"
    $jsonPath = Join-Path $FolderPath ("inquiry-" + (Get-Date).ToString("yyyyMMdd-HHmmssfff") + ".json")

    $Record | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonPath -Encoding UTF8

    if (Test-Path $csvPath) {
        $Record | Export-Csv -Path $csvPath -Append -NoTypeInformation -Encoding UTF8
    }
    else {
        $Record | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
    }

    return [PSCustomObject]@{
        CsvPath  = $csvPath
        JsonPath = $jsonPath
    }
}

function Send-InquiryEmail {
    param(
        [Parameter(Mandatory = $true)] $Settings,
        [Parameter(Mandatory = $true)] $Record
    )

    $securePassword = ConvertTo-SecureString $Settings.smtpPassword -AsPlainText -Force
    $credential = [System.Management.Automation.PSCredential]::new($Settings.smtpUsername, $securePassword)

    $subject = "New website inquiry - $($Record.FullName)"
    $body = @"
A new website inquiry was submitted.

Submitted at: $($Record.SubmittedAt)
Full name: $($Record.FullName)
Company name: $($Record.CompanyName)
Email: $($Record.EmailAddress)
WhatsApp: $($Record.WhatsApp)
Country: $($Record.Country)
Business type: $($Record.BusinessType)
Product interest: $($Record.ProductInterest)
Estimated quantity: $($Record.EstimatedQuantity)
Need custom logo: $($Record.NeedCustomLogo)
Packaging requirement: $($Record.PackagingRequirement)

Message:
$($Record.Message)
"@

    Send-MailMessage `
        -SmtpServer $Settings.smtpServer `
        -Port ([int]$Settings.smtpPort) `
        -UseSsl `
        -Credential $credential `
        -From $Settings.fromEmail `
        -To $Settings.toEmail `
        -Subject $subject `
        -Body $body `
        -Encoding UTF8
}

function Handle-InquiryRequest {
    param($Context)

    if ($Context.Request.HttpMethod -ne "POST") {
        Write-JsonResponse -Context $Context -StatusCode 405 -Payload @{
            ok = $false
            message = "Method not allowed."
        }
        return
    }

    $rawBody = Read-RequestBody -Request $Context.Request
    if ([string]::IsNullOrWhiteSpace($rawBody)) {
        Write-JsonResponse -Context $Context -StatusCode 400 -Payload @{
            ok = $false
            message = "Inquiry payload is empty."
        }
        return
    }

    $payload = $rawBody | ConvertFrom-Json
    foreach ($field in @("fullName", "emailAddress", "message")) {
        if ([string]::IsNullOrWhiteSpace([string]$payload.$field)) {
            Write-JsonResponse -Context $Context -StatusCode 400 -Payload @{
                ok = $false
                message = "Please complete the required inquiry fields before submitting."
            }
            return
        }
    }

    $record = ConvertTo-InquiryRecord -Payload $payload
    $settings = Get-ContactSettings
    $inquiryFolder = if ($settings -and -not [string]::IsNullOrWhiteSpace([string]$settings.inquiryFolder)) {
        [string]$settings.inquiryFolder
    }
    else {
        $defaultInquiryFolder
    }

    $saved = Save-InquiryRecord -Record $record -FolderPath $inquiryFolder

    if (-not (Test-EmailSettingsReady -Settings $settings)) {
        Write-JsonResponse -Context $Context -StatusCode 200 -Payload @{
            ok = $true
            message = "Inquiry saved locally. Email forwarding is not configured yet."
            savedTo = $saved.CsvPath
        }
        return
    }

    try {
        Send-InquiryEmail -Settings $settings -Record $record
    }
    catch {
        Write-JsonResponse -Context $Context -StatusCode 500 -Payload @{
            ok = $false
            message = "Inquiry saved locally, but email sending failed. Please check the QQ SMTP configuration."
            savedTo = $saved.CsvPath
        }
        return
    }

    Write-JsonResponse -Context $Context -StatusCode 200 -Payload @{
        ok = $true
        message = "Inquiry submitted successfully. It has been saved locally and sent to email."
        savedTo = $saved.CsvPath
    }
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Serving demo at $prefix from $root"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            if ($context.Request.Url.AbsolutePath -eq "/api/inquiry") {
                Handle-InquiryRequest -Context $context
                continue
            }

            $path = Resolve-RequestPath -RawPath $context.Request.RawUrl
            if (-not (Test-Path $path) -or (Get-Item $path).PSIsContainer) {
                $context.Response.StatusCode = 404
                $buffer = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
                $context.Response.ContentType = "text/plain; charset=utf-8"
                $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            else {
                $bytes = [System.IO.File]::ReadAllBytes($path)
                $context.Response.StatusCode = 200
                $context.Response.ContentType = Get-ContentType -Path $path
                $context.Response.ContentLength64 = $bytes.Length
                $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        }
        catch {
            $context.Response.StatusCode = 500
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("Server Error")
            $context.Response.ContentType = "text/plain; charset=utf-8"
            $context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        finally {
            $context.Response.OutputStream.Close()
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
