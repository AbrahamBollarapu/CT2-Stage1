# Stops and cleans up
$files = @(
  "-f","docker-compose.s1.yml",
  "-f","docker-compose.env.yml",
  "-f","docker-compose.traefik.yml",
  "-f","docker-compose.days1-4.yml",
  "-f","docker-compose.routers.yml",
  "-f","docker-compose.prefixes.yml",
  "-f","docker-compose.routers-nostrip.yml",
  "-f","docker-compose.s1-healthchecks.yml"
)
docker compose --profile day1 --profile day2 $files down --remove-orphans
