param (
  [string]$deviceName = 'Quest',
  [Parameter(Mandatory = $true)]
  [string]$sourcePath,
  [Parameter(Mandatory = $true)]
  [string]$filter
)

$Shell = New-Object -ComObject Shell.Application;

# 17 is the default explorer
$deviceObject = $shell.NameSpace(17).self.GetFolder.items() | Where-Object { $_.name -eq $deviceName };

$internalStorageName = ($deviceObject.GetFolder.Items() | Select-Object Name).Name;

[string]$targetPath = '\' + $internalStorageName + '\Android\data\com.KinemotikStudios.AudioTripQuest\files\Songs';

$SourceFolder = $Shell.NameSpace($sourcePath).self.GetFolder();

$joinedPath = (Join-path $deviceObject.Path $targetPath);

$DestFolder = $Shell.NameSpace($joinedPath).self.GetFolder();

foreach ($Item in $SourceFolder.Items() | Where-Object { $_.Name -match $filter }) {
  $DestFolder.CopyHere($Item);
}