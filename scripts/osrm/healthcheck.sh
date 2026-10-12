#!/bin/bash
set -euo pipefail
# Official image has bash, not curl/wget. Test a real nearest-road query in HCMC.
exec 3<>/dev/tcp/127.0.0.1/5000
printf 'GET /nearest/v1/driving/106.7009,10.7769?number=1 HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3
response=$(cat <&3)
[[ "$response" == *'200 OK'* && "$response" == *'"code":"Ok"'* ]]
