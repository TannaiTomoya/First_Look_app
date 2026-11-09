#!/usr/bin/env bash
# RLS テストを使い捨ての Postgres コンテナで実行する（本番 DB には触れない）
# 使い方: ./supabase/tests/run.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
MIG="$DIR/../migrations"
NAME="firstlook-rls-test-$$"

docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=postgres postgres:16-alpine >/dev/null
trap 'docker stop "$NAME" >/dev/null' EXIT
until docker exec "$NAME" pg_isready -U postgres -q; do sleep 0.5; done
sleep 1

psql_in() { docker exec -i -e PGOPTIONS="${PGOPTIONS:-}" "$NAME" psql -U postgres -X -q "$@"; }

for f in "$DIR/stub_supabase.sql" "$MIG/0001_init.sql" \
  "${MIGRATION_0009:-$MIG/0009_face_landmark_snapshots.sql}" "${MIGRATION_0010:-$MIG/0010_profiles_protect_columns.sql}"; do
  PGOPTIONS="-c client_min_messages=warning" psql_in -v ON_ERROR_STOP=1 < "$f" >/dev/null
done

out="$(psql_in < "$DIR/face_landmark_snapshots.test.sql" 2>&1 || true)"
out+=$'\n'"$(psql_in < "$DIR/profiles.test.sql" 2>&1 || true)"

# 並行実行：取り消しと登録が同時に走っても snapshot が残らない（上のテストの続きの状態を使う）
as_user() { printf "select set_config('request.jwt.claim.sub', '%s', false); set role authenticated;\n" "$1"; }
B=bbbbbbbb-0000-0000-0000-000000000002
C=cccccccc-0000-0000-0000-000000000003
INS="insert into public.face_landmark_snapshots (jaw_width, cheek_width, jaw_ratio, face_aspect, yaw, pitch, roll, registration, quality_ok, model_version) values (1.3, 1.6, 0.8, 1.3, 0, 0, 0, 'matrix', true, 'race');"

q() { echo "$1" | psql_in -At; }
# 相手のトランザクションが pg_sleep で止まるまで待つ。先に失敗して止まらなければ 5 秒で諦める
wait_sleeping() {
  for _ in $(seq 50); do
    [[ "$(q "select count(*) from pg_stat_activity where wait_event = 'PgSleep'")" -ge 1 ]] && return 0
    sleep 0.1
  done
  return 1
}

# 登録が先：登録トランザクションが確定前に止まっている間に取り消す
before=$(q "select count(*) from public.face_landmark_snapshots where user_id = '$B'")
{ as_user "$B"; echo "begin; $INS select pg_sleep(1.5); commit;"; } | psql_in -v ON_ERROR_STOP=1 >/dev/null 2>&1 &
p1=$!
wait_sleeping || true
inflight=$(q "select count(*) from public.face_landmark_snapshots where user_id = '$B'")
{ as_user "$B"; echo "select public.set_landmark_consent(false);"; } | psql_in >/dev/null 2>&1
wait "$p1" && ins_ok=1 || ins_ok=0
n=$(q "select count(*) from public.face_landmark_snapshots where user_id = '$B'")
ok=$([[ "$ins_ok" == 1 && "$inflight" == "$before" && "$n" == 0 ]] && echo ok || echo not ok)
out+=$'\n'"NOTICE:  $ok - 登録中に同意を取り消しても、登録した snapshot は残らない"

# 取り消しが先：取り消しトランザクションが確定前に止まっている間に登録する
{ as_user "$C"; echo "begin; select public.set_landmark_consent(false); select pg_sleep(1.5); commit;"; } | psql_in >/dev/null 2>&1 &
p2=$!
wait_sleeping || true
race_err=$({ as_user "$C"; echo "$INS"; } | psql_in 2>&1 >/dev/null || true)
wait "$p2" || true
n=$(q "select count(*) from public.face_landmark_snapshots where user_id = '$C'")
ok=$([[ "$n" == 0 && "$race_err" == *"landmark consent required"* ]] && echo ok || echo not ok)
out+=$'\n'"NOTICE:  $ok - 取り消し中に始まった登録は失敗する"

echo "$out" | sed -n 's/.*NOTICE:  //p'
echo "$out" | grep -E "ERROR" || true

pass=$(echo "$out" | grep -c "NOTICE:  ok - " || true)
fail=$(echo "$out" | grep -c "NOTICE:  not ok - " || true)
errors=$(echo "$out" | grep -c "ERROR" || true)
echo "---"
echo "pass=$pass fail=$fail errors=$errors"
[[ "$fail" -eq 0 && "$errors" -eq 0 && "$pass" -gt 0 ]]
