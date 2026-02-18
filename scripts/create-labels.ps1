#!/usr/bin/env pwsh
# GitHub Labels Creation Script for space_framework (Rule 12)
# Usage: .\create-labels.ps1 -Owner nsin08 -Repo ai_fleet
# Or paste each gh command below directly in your terminal

param(
    [string]$Owner = "nsin08",
    [string]$Repo = "ai_fleet"
)

# Colors for terminal output
$colors = @{
    "state" = "0366D6"     # Blue
    "type" = "D4AF37"      # Gold
    "priority" = "DC3545"  # Red
    "role" = "6F42C1"      # Purple
    "needs" = "FFA500"     # Orange
}

# STATE LABELS (Rule 01 - State Machine)
# Idea → Approved → Ready → In Progress → In Review → Done → Released
$stateLabels = @(
    @{name="state:idea"; description="Initial feature request or idea"; color=$colors.state}
    @{name="state:approved"; description="Idea approved by PM/Architect"; color=$colors.state}
    @{name="state:ready"; description="Ready for implementation (meets DoR)"; color=$colors.state}
    @{name="state:in-progress"; description="Currently being implemented"; color=$colors.state}
    @{name="state:in-review"; description="In code review"; color=$colors.state}
    @{name="state:done"; description="Complete and merged (meets DoD)"; color=$colors.state}
    @{name="state:released"; description="Deployed to production"; color=$colors.state}
)

# TYPE LABELS (Rule 12 - Artifact Type)
$typeLabels = @(
    @{name="type:idea"; description="Feature idea or request"; color=$colors.type}
    @{name="type:epic"; description="Large feature or work stream"; color=$colors.type}
    @{name="type:story"; description="User story (implementable unit)"; color=$colors.type}
    @{name="type:task"; description="Engineering task (docs/chore/refactor)"; color=$colors.type}
    @{name="type:bug"; description="Bug fix"; color=$colors.type}
    @{name="type:chore"; description="Infrastructure/maintenance"; color=$colors.type}
    @{name="type:docs"; description="Documentation"; color=$colors.type}
)

# PRIORITY LABELS (Rule 12 - Priority)
$priorityLabels = @(
    @{name="priority:critical"; description="Blocks other work or production"; color=$colors.priority}
    @{name="priority:high"; description="Important, should be next"; color=$colors.priority}
    @{name="priority:medium"; description="Standard priority"; color=$colors.priority}
    @{name="priority:low"; description="Nice to have"; color=$colors.priority}
)

# ROLE LABELS (Rule 12 - Assigned Role)
$roleLabels = @(
    @{name="role:sme"; description="Subject matter expert input needed"; color=$colors.role}
    @{name="role:architect"; description="Requires architectural review"; color=$colors.role}
    @{name="role:reviewer"; description="Requires code review"; color=$colors.role}
    @{name="role:devops"; description="DevOps/infrastructure task"; color=$colors.role}
)

# NEEDS LABELS (Rule 12 - Blockers)
$needsLabels = @(
    @{name="needs:design"; description="Requires design decision"; color=$colors.needs}
    @{name="needs:sre"; description="SRE input needed"; color=$colors.needs}
    @{name="needs:testing"; description="Additional testing required"; color=$colors.needs}
    @{name="needs:documentation"; description="Documentation required"; color=$colors.needs}
)

# Combine all labels
$allLabels = @()
$allLabels += $stateLabels
$allLabels += $typeLabels
$allLabels += $priorityLabels
$allLabels += $roleLabels
$allLabels += $needsLabels

# Create labels using gh cli
Write-Host "Creating $($allLabels.Count) labels for $Owner/$Repo..." -ForegroundColor Green

$created = 0
$skipped = 0

foreach ($label in $allLabels) {
    $labelName = $label.name
    $description = $label.description
    $color = $label.color
    
    try {
        gh label create $labelName `
            --description "$description" `
            --color "$color" `
            --repo "$Owner/$Repo" 2>$null
        $created++
        Write-Host "✓ Created: $labelName" -ForegroundColor Green
    }
    catch {
        # Label might already exist
        $skipped++
        Write-Host "⊘ Skipped: $labelName (already exists)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Created: $created labels"
Write-Host "  Skipped: $skipped labels (already existed)"
Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan
Write-Host "  Check labels: gh label list --repo $Owner/$Repo"
