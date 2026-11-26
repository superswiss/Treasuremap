$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$contentPath = Join-Path $root "content\steve-transmissions.json"
$outputDir = Join-Path $root "audio\steve"
$glitchScript = Join-Path $PSScriptRoot "glitch-audio.py"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Add-Type -AssemblyName System.Speech

$config = Get-Content -LiteralPath $contentPath -Raw | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }

function Find-Python {
    $python = Get-Command python -ErrorAction SilentlyContinue

    if ($python) {
        return $python.Source
    }

    $codexPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

    if (Test-Path -LiteralPath $codexPython) {
        return $codexPython
    }

    return $null
}

function Select-VoiceName {
    param(
        [string] $Hint
    )

    $match = $voices | Where-Object { $_ -like "*$Hint*" } | Select-Object -First 1

    if ($match) {
        return $match
    }

    return $voices | Select-Object -First 1
}

$generated = @()
$pythonPath = Find-Python

foreach ($property in $config.transmissions.PSObject.Properties) {
    $transmission = $property.Value
    $profile = $config.ttsProfiles.$($transmission.ttsProfile)
    $voiceName = Select-VoiceName -Hint $profile.voiceHint
    $fileName = Split-Path $transmission.audio -Leaf
    $outputPath = Join-Path $outputDir $fileName

    $synth.SelectVoice($voiceName)
    $synth.Rate = [int] $profile.sapiRate
    $synth.Volume = 100
    $synth.SetOutputToWaveFile($outputPath)
    $synth.Speak($transmission.text)
    $synth.SetOutputToDefaultAudioDevice()

    $generated += $outputPath

    if ($transmission.effects -and (Test-Path -LiteralPath $glitchScript)) {
        $effectMode = "minor"

        if ($transmission.effects -contains "villainGlitch") {
            $effectMode = "villain"
        }

        if ($pythonPath) {
            $tempPath = "$outputPath.tmp.wav"
            & $pythonPath $glitchScript $outputPath $tempPath $effectMode
            Move-Item -LiteralPath $tempPath -Destination $outputPath -Force
        }
        else {
            Write-Warning "Python was not found. Generated clean speech for $fileName without glitch processing."
        }
    }

    Write-Host "Generated $fileName"
}

Write-Host ""
Write-Host "Generated $($generated.Count) STEVE audio files in $outputDir"
