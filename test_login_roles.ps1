# Test login redirects for different roles
$roles = @(
    @{ email = "admin@minimart.com"; password = "admin123"; expected = "/" },
    @{ email = "cashier@minimart.com"; password = "cashier123"; expected = "/pos" },
    @{ email = "manager@minimart.com"; password = "admin123"; expected = "/pos" },
    @{ email = "inventory@minimart.com"; password = "inventory123"; expected = "/pos" },
    @{ email = "hr@minimart.com"; password = "hr123"; expected = "/" },
    @{ email = "employee@minimart.com"; password = "employee123"; expected = "/" }
)

foreach ($role in $roles) {
    Write-Host "Testing $($role.email)..." -NoNewline
    try {
        $login = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/login" -Method POST -ContentType "application/json" -Body (@{ email = $role.email; password = $role.password } | ConvertTo-Json) -TimeoutSec 15
        $h = @{ Authorization = "Bearer $($login.data.token)" }
        $roleSlug = $login.data.user.role.slug
        Write-Host " Role: $roleSlug"
        Write-Host " Expected redirect: $($role.expected)"
    } catch {
        Write-Host " FAILED: $($_.Exception.Message)"
    }
}