#!/bin/bash
# Generate rich demo data for Smart Attendance
# Run: bash scripts/generate-demo-data.sh

set -e
API="http://localhost:3000/api/v1"
CT="Content-Type: application/json"

echo "🔐 Login admin..."
TOKEN=$(curl -s -X POST "$API/auth/login" -H "$CT" \
  -d '{"email":"admin@demo.com","password":"Admin@123"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['access_token'])")
AUTH="Authorization: Bearer $TOKEN"

echo "✅ Token OK"

# ============ CREATE 7 MORE BRANCHES (total 10) ============
echo ""
echo "🏢 Creating branches..."

declare -a BRANCH_CODES=("SG-Q7" "SG-Q2" "SG-TDUC" "HP-LECHAN" "CT-NINHKIEU" "BD-THUANAN" "HUE-CENTER")
declare -a BRANCH_NAMES=("Sài Gòn Quận 7" "Sài Gòn Quận 2" "Sài Gòn Thủ Đức" "Hải Phòng Lê Chân" "Cần Thơ Ninh Kiều" "Bình Dương Thuận An" "Huế Trung Tâm")
declare -a BRANCH_LATS=("10.7340" "10.7870" "10.8510" "20.8449" "10.0341" "11.0054" "16.4637")
declare -a BRANCH_LNGS=("106.7220" "106.7510" "106.7540" "106.6881" "105.7676" "106.6520" "107.5909")

for i in "${!BRANCH_CODES[@]}"; do
  CODE="${BRANCH_CODES[$i]}"
  NAME="${BRANCH_NAMES[$i]}"
  LAT="${BRANCH_LATS[$i]}"
  LNG="${BRANCH_LNGS[$i]}"

  RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/branches" -H "$CT" -H "$AUTH" \
    -d "{\"code\":\"$CODE\",\"name\":\"Chi nhánh $NAME\",\"address\":\"$NAME, Việt Nam\",\"latitude\":$LAT,\"longitude\":$LNG,\"radius_meters\":200}")

  if [ "$RESULT" = "201" ]; then
    echo "  ✅ $CODE created"
  else
    echo "  ⚠️  $CODE skipped (exists or error: $RESULT)"
  fi
done

# Get all branch IDs
echo ""
echo "📋 Fetching branch list..."
BRANCHES_JSON=$(curl -s "$API/branches?limit=100" -H "$AUTH")
echo "$BRANCHES_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for b in d['data']:
    print(f\"  {b['code']}: {b['id']}\")
print(f\"Total: {d['meta']['total']} branches\")
"

# ============ CREATE 70 MORE EMPLOYEES (total ~100) ============
echo ""
echo "👥 Creating employees (70 new)..."

BRANCH_IDS=$(echo "$BRANCHES_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for b in d['data']:
    print(b['id'])
")

BRANCH_ARRAY=($BRANCH_IDS)
TOTAL_BRANCHES=${#BRANCH_ARRAY[@]}

FIRST_NAMES=("Nguyễn" "Trần" "Lê" "Phạm" "Hoàng" "Huỳnh" "Phan" "Vũ" "Võ" "Đặng" "Bùi" "Đỗ" "Hồ" "Ngô" "Dương")
MIDDLE_NAMES=("Văn" "Thị" "Hữu" "Minh" "Đức" "Thanh" "Quốc" "Hoài" "Ngọc" "Anh")
LAST_NAMES=("An" "Bình" "Châu" "Dũng" "Em" "Giang" "Hải" "Khánh" "Linh" "Mai" "Nam" "Phương" "Quân" "Sơn" "Tâm" "Uyên" "Vinh" "Xuân" "Yến")

CREATED=0
SKIPPED=0

for i in $(seq 31 100); do
  CODE=$(printf "EMP-%03d" $i)
  FN_IDX=$((RANDOM % ${#FIRST_NAMES[@]}))
  MN_IDX=$((RANDOM % ${#MIDDLE_NAMES[@]}))
  LN_IDX=$((RANDOM % ${#LAST_NAMES[@]}))
  FULL_NAME="${FIRST_NAMES[$FN_IDX]} ${MIDDLE_NAMES[$MN_IDX]} ${LAST_NAMES[$LN_IDX]}"
  EMAIL="emp${i}@smartattendance.vn"
  BRANCH_IDX=$((i % TOTAL_BRANCHES))
  BRANCH_ID="${BRANCH_ARRAY[$BRANCH_IDX]}"
  PHONE="09$(printf '%08d' $((RANDOM % 100000000)))"

  RESULT=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/employees" -H "$CT" -H "$AUTH" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"Demo@1234\",\"full_name\":\"$FULL_NAME\",\"phone\":\"$PHONE\",\"employee_code\":\"$CODE\",\"primary_branch_id\":\"$BRANCH_ID\",\"role\":\"employee\"}")

  if [ "$RESULT" = "201" ]; then
    CREATED=$((CREATED + 1))
  else
    SKIPPED=$((SKIPPED + 1))
  fi

  # Progress every 10
  if [ $((i % 10)) -eq 0 ]; then
    echo "  ... $i/100 (created: $CREATED, skipped: $SKIPPED)"
  fi
done

echo "  ✅ Employees done: created=$CREATED, skipped=$SKIPPED"

# ============ ADD WIFI + GEOFENCE FOR NEW BRANCHES ============
echo ""
echo "📡 Adding WiFi + Geofence configs..."

WIFI_IDX=1
for BRANCH_ID in "${BRANCH_ARRAY[@]}"; do
  BSSID=$(printf "AA:BB:CC:%02X:%02X:%02X" $((WIFI_IDX / 256)) $((WIFI_IDX % 256)) $((WIFI_IDX * 7 % 256)))

  # WiFi config
  curl -s -o /dev/null -w "" -X POST "$API/branches/$BRANCH_ID/wifi-configs" -H "$CT" -H "$AUTH" \
    -d "{\"ssid\":\"SA-Office-$WIFI_IDX\",\"bssid\":\"$BSSID\",\"priority\":0}" 2>/dev/null

  # Geofence (get branch lat/lng from API)
  BRANCH_DATA=$(curl -s "$API/branches/$BRANCH_ID" -H "$AUTH")
  LAT=$(echo "$BRANCH_DATA" | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['latitude'])" 2>/dev/null || echo "10.7769")
  LNG=$(echo "$BRANCH_DATA" | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['longitude'])" 2>/dev/null || echo "106.7009")

  curl -s -o /dev/null -w "" -X POST "$API/branches/$BRANCH_ID/geofences" -H "$CT" -H "$AUTH" \
    -d "{\"name\":\"Main Gate\",\"center_lat\":$LAT,\"center_lng\":$LNG,\"radius_meters\":150}" 2>/dev/null

  WIFI_IDX=$((WIFI_IDX + 1))
done

echo "  ✅ WiFi + Geofence added for all branches"

# ============ GENERATE CHECK-IN DATA VIA DIRECT DB ============
echo ""
echo "📊 Triggering daily summary cron for last 14 days..."

for DAYS_AGO in $(seq 1 14); do
  DATE=$(python3 -c "from datetime import datetime, timedelta; print((datetime.now() - timedelta(days=$DAYS_AGO)).strftime('%Y-%m-%d'))")
  RESULT=$(curl -s -X POST "$API/admin/jobs/daily-summary/run" -H "$CT" -H "$AUTH" \
    -d "{\"for_date\":\"$DATE\"}" \
    | python3 -c "import json,sys;d=json.load(sys.stdin);r=d.get('data',{}).get('result',{});print(f'upserted={r.get(\"upserted\",0)}')" 2>/dev/null || echo "error")
  echo "  $DATE: $RESULT"
done

# ============ TRIGGER ANOMALY DETECTION ============
echo ""
echo "🚨 Triggering anomaly detection..."
ANOMALY=$(curl -s -X POST "$API/admin/jobs/anomaly-detection/run" -H "$CT" -H "$AUTH" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('data',{}).get('result',{})
print(f\"suspicious: {len(r.get('suspicious_employees',[]))}\")
print(f\"late_spike: {len(r.get('branches_high_late_rate',[]))}\")
print(f\"devices: {len(r.get('untrusted_devices',[]))}\")
")
echo "$ANOMALY"

# ============ FINAL COUNTS ============
echo ""
echo "=== FINAL DATA COUNTS ==="
curl -s "$API/branches?limit=1" -H "$AUTH" | python3 -c "import json,sys;print('Branches:',json.load(sys.stdin)['meta']['total'])"
curl -s "$API/employees?limit=1" -H "$AUTH" | python3 -c "import json,sys;print('Employees:',json.load(sys.stdin)['meta']['total'])"
curl -s "$API/attendance/sessions?limit=1" -H "$AUTH" | python3 -c "import json,sys;print('Sessions:',json.load(sys.stdin)['meta']['total'])"

echo ""
echo "🎉 Demo data generation complete!"
echo "Open http://localhost:4200 to see rich dashboards"
echo "Open http://localhost:8100 for mobile app"
