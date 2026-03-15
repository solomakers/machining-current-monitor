# CLAUDE.md

このファイルは、EnOcean USB 400J を用いた電流監視システムの実装時に Claude Code が常時参照する開発指示書である。

対象システム:
- 受信PC: USB 400J から ESP3 電文を受信し、CWD-3-1 の電流データへ変換してクラウドへ送信する
- バックエンド: Supabase (Postgres / Edge Functions / Auth / Storageは必要時のみ)
- フロントエンド: Vercel 上の Next.js アプリ
- 通信回線: 受信PC から LTE ルータ経由で HTTPS にて送信

---

## 1. ゴール

実装の第一目的は次の3点である。

1. USB 400J から EnOcean 電文を安定受信する
2. CWD-3-1 の 3相電流データを正しく正規化し Supabase に保存する
3. Vercel フロントエンドで設備ごとのトレンドを閲覧できるようにする

重要:
- 「まず動くこと」を優先する
- 受信処理とクラウド処理と画面処理を疎結合にする
- 後で設備追加・画面追加・アラート追加がしやすい構造にする

---

## 2. リポジトリ構成

モノレポ構成を前提とする。

```text
repo-root/
  CLAUDE.md
  README.md
  .editorconfig
  .gitignore
  .github/
    workflows/
  apps/
    receiver/
    frontend/
  packages/
    domain/
    config/
    client/
  supabase/
    migrations/
    functions/
    seed/
  docs/
    openapi.yaml
    architecture.md
```

### apps/receiver
受信PCで動作する常駐アプリ。
責務:
- USB 400J 仮想COMの接続
- ESP3 パケット受信
- 対象センサの識別
- CWD-3-1 ペイロードのデコード
- A 値への変換
- 再送制御付き HTTPS 送信
- ローカルスプール保存
- ヘルスチェック出力

### apps/frontend
Vercel にデプロイする Next.js アプリ。
責務:
- 設備一覧
- 最新値表示
- 時系列グラフ表示
- 日別集計表示
- 通信状態表示
- 認証済みユーザー向け画面提供

### packages/domain
ドメインモデル、型、バリデーションを集約する。
責務:
- telemetry schema
- device schema
- gateway schema
- unit conversion
- alarm 判定ロジックの共通化

### packages/client
API クライアント。
責務:
- receiver から ingestion API を叩くためのクライアント
- frontend から集計APIやRPCを叩くためのクライアント

### supabase/
Supabase 管理用。
責務:
- SQL migration
- Edge Functions
- 必要な seed データ

---

## 3. 技術スタック

### 共通
- TypeScript を第一候補にする
- Node.js LTS を利用する
- パッケージマネージャは pnpm
- フォーマッタは Prettier
- Linter は ESLint
- テストは Vitest

### receiver
- Node.js + TypeScript
- serialport ライブラリで USB 仮想COM を扱う
- zod で入力検証
- pino で構造化ログ
- systemd サービス化を前提とする
- SQLite または JSONL ファイルをローカルスプールに使う

### frontend
- Next.js App Router
- TypeScript
- React Server Components を基本
- グラフは Recharts または ECharts
- UI は shadcn/ui を優先

### backend
- Supabase Postgres
- Supabase Edge Functions (Deno)
- Supabase Auth
- 必要に応じて Postgres View / RPC

---

## 4. 設計原則

1. 受信PCは「取得して送る」に集中し、業務ロジックを持ちすぎない
2. 電文デコード結果は必ず生値と正規化値の両方を残す
3. API入出力は zod / JSON Schema と整合させる
4. DBスキーマ変更は migration のみで行う
5. frontend から service_role key を使わない
6. service_role key は Supabase Edge Functions またはサーバサイドのみ
7. リトライは冪等性を前提に設計する
8. 「通信断でもデータを失いにくい」を重視する

---

## 5. 受信システム要件

### 5.1 シリアル接続
- USB 400J を仮想COMとして開く
- ポート設定値は環境変数化する
- 起動時にポート列挙ログを出す
- 切断時は自動再接続する

想定環境変数:
- `SERIAL_PORT=/dev/ttyUSB0`
- `SERIAL_BAUD_RATE=57600`
- `SERIAL_DATA_BITS=8`
- `SERIAL_STOP_BITS=1`
- `SERIAL_PARITY=none`

### 5.2 ESP3 受信
- ESP3 フレーム境界を正しく処理する
- CRC エラー時は破棄しログ出力
- Radio Packet を対象にする
- Teach-In / Data の区別を行う

### 5.3 センサ識別
- CWD-3-1 の機器IDを device_id として扱う
- 初回検知時は unknown device として記録し、以後 DB 上で設備に紐付ける
- allowlist モードを持てるようにする

### 5.4 データ変換
受信時に以下のオブジェクトへ正規化する。

```ts
interface TelemetrySample {
  gatewayId: string
  deviceId: string
  machineId?: string
  observedAt: string
  receivedAt: string
  phaseL1CurrentA: number | null
  phaseL2CurrentA: number | null
  phaseL3CurrentA: number | null
  ctModelL1?: string | null
  ctModelL2?: string | null
  ctModelL3?: string | null
  rawPayloadHex: string
  rssi?: number | null
  repeaterCount?: number | null
  parserVersion: string
  source: 'enocean-usb400j'
}
```

### 5.5 送信制御
- HTTPS POST で ingestion API に送る
- 送信失敗時はローカルへスプール
- 復旧後は古い順に再送
- リトライは指数バックオフ
- 同一イベントの二重送信を許容し、サーバ側で冪等化する

### 5.6 監視
最低限の状態指標:
- 受信プロセス起動状態
- 最終受信時刻
- 最終送信成功時刻
- スプール件数
- 直近5分の受信件数
- 直近5分の送信失敗件数

---

## 6. API方針

- 仕様書は `docs/openapi.yaml` を正本とする
- receiver は OpenAPI から生成した型または hand-written client を使う
- 認証は Bearer token を基本とする
- トークンは gateway 単位で発行し、ローテーション可能にする
- API は ingest と heartbeat を分離する
- 冪等キー `eventId` を必須とする

`eventId` の推奨生成規則:
- `sha256(deviceId + observedAt + rawPayloadHex)` の先頭32文字

---

## 7. Supabase データモデル

最低限必要なテーブル:

### gateways
- id
- name
- site_code
- status
- last_seen_at
- created_at
- updated_at

### devices
- id
- enocean_device_id
- machine_id
- machine_name
- site_code
- installed_at
- is_active
- created_at
- updated_at

### telemetry_events
- id (uuid)
- event_id (unique)
- gateway_id
- device_id
- observed_at
- received_at
- phase_l1_current_a
- phase_l2_current_a
- phase_l3_current_a
- raw_payload_hex
- parser_version
- rssi
- repeater_count
- source
- inserted_at

### gateway_heartbeats
- id
- gateway_id
- status
- sent_at
- spool_depth
- meta_json

### alerts (将来)
- id
- machine_id
- alert_type
- severity
- started_at
- ended_at
- payload_json

### 集計ビュー候補
- `telemetry_latest_per_device`
- `telemetry_1min_rollup`
- `telemetry_5min_rollup`
- `telemetry_daily_rollup`

---

## 8. RLS / セキュリティ方針

- `telemetry_events` 生テーブルへの直接書き込みは Edge Function のみ
- frontend は直接 insert しない
- frontend は anon key で読み取り可能範囲を制限する
- site 単位の閲覧制限が必要な場合は user profile と site_code を紐付ける
- service_role は Vercel のサーバサイドまたは Supabase Functions のみ
- ブラウザへ service_role を渡してはいけない

---

## 9. Frontend 要件

### 画面
1. ログイン
2. ダッシュボード
3. 設備一覧
4. 設備詳細
5. ゲートウェイ状態
6. 未登録デバイス一覧

### ダッシュボード要件
- 現在通信中の設備数
- 異常通信台数
- 最新受信時刻
- 直近24時間の平均電流推移

### 設備詳細要件
- 最新の L1/L2/L3 電流
- 1時間 / 24時間 / 7日 のグラフ切り替え
- 日別平均
- 相アンバランス表示
- 最終受信時刻
- ゲートウェイID
- デバイスID

### UX方針
- 「通信断」を数値欠損と区別して表示する
- 電流が 0 に近い状態と「データ未受信」を別表現にする
- 時刻は JST 表示を基本とする

---

## 10. テスト方針

### unit test
- ESP3 フレームパーサ
- CWD-3-1 ペイロードデコーダ
- eventId 生成
- 冪等送信処理
- CT換算ロジック

### integration test
- モックシリアル入力 → パース → API 送信
- API 受信 → Supabase insert
- frontend の主要画面データ取得

### e2e test
- seed データを使った設備詳細表示
- ダッシュボードの時系列表示

### 非機能試験
- LTE切断時のスプール継続
- LTE復旧時の再送
- USB抜き差し後の再接続

---

## 11. コーディングルール

- any を安易に使わない
- unknown を使って明示的に narrowing する
- 例外は握りつぶさず、構造化ログへ出す
- 日付は ISO 8601 UTC で保存する
- 画面表示時のみ JST へ変換する
- DB へ入れる前に zod で必ず validate する
- API レスポンス型は必ず共有型へ寄せる

---

## 12. Claude Code の作業ルール

Claude Code は以下の順で作業すること。

1. 変更前に関連ファイルを読む
2. 影響範囲を明示してから編集する
3. 1つのPRで責務を詰め込みすぎない
4. migration とアプリコードを分離してレビューしやすくする
5. 変更後は必ずテスト、lint、typecheck を走らせる
6. 失敗したら原因をログと差分から説明する

Claude Code が優先して守ること:
- 既存設計との整合性
- secrets をコードへ直書きしない
- OpenAPI と実装の乖離を作らない
- UI都合で生データを改ざんしない

---

## 13. 実装順序

### フェーズ1
- receiver のシリアル受信
- ESP3 パーサ
- ダミー HTTP 送信
- ローカルスプール

### フェーズ2
- Supabase schema
- ingestion Edge Function
- heartbeat Edge Function
- device / gateway 管理テーブル

### フェーズ3
- frontend ダッシュボード
- 設備一覧
- 設備詳細

### フェーズ4
- アラート
- 未登録デバイス承認UI
- CSV export

---

## 14. 受入基準

最低受入基準:
- USB 400J から受信した対象電文を 95%以上で取り込める
- LTE遮断中も 24時間分以上をローカル保持できる
- LTE復旧後に時系列順で再送できる
- 受信から Supabase 保存まで通常60秒以内
- Vercel 画面で設備詳細の最新値と 24時間グラフが見られる

---

## 15. 環境変数一覧

### receiver
- `SERIAL_PORT`
- `SERIAL_BAUD_RATE`
- `GATEWAY_ID`
- `INGEST_API_BASE_URL`
- `INGEST_API_TOKEN`
- `HEARTBEAT_INTERVAL_SEC`
- `SPOOL_DIR`
- `LOG_LEVEL`

### frontend (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`  ※サーバサイドのみ

### supabase function
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INGEST_GATEWAY_TOKEN_MAP` または相当の安全な認証情報

---

## 16. Raspberry Pi (受信PC) 構成

### ハードウェア
- Raspberry Pi 400（キーボード一体型）
- USB 400J（EnOcean受信機、USB-Aポートに接続）
- CWD-3-1（3相電流センサ）
- 電源: USB-C アダプタ
- 通信: WiFi → LTE ルータ経由で HTTPS

### 構成図
```
CWD-3-1 → (928MHz無線) → USB 400J → RPi 400 → (WiFi/LTE) → Supabase
```

### デプロイ関連ファイル
- `deploy/receiver.service` — systemd ユニットファイル
- `deploy/99-usb400j.rules` — udev ルール（デバイスパス固定）
- `scripts/setup-receiver.sh` — ラズパイ初期セットアップスクリプト
- `docs/raspberry-pi-setup.md` — セットアップ手順書

### 運用要件
- systemd で自動起動・自動復旧（Restart=always）
- WatchdogSec=300 でハングアップ検知
- メモリ上限 256MB
- ログは journald に出力
- スプールディレクトリのみ書き込み可（セキュリティ強化）

---

## 17. 未確定事項

実装前に確定すべき項目:
- CWD-3-1 の実データマッピング詳細
- CT型番ごとの換算式の最終確定
- gatewayId 命名規則
- machineId 命名規則
- 閲覧権限の粒度
- 保持期間
- アラート条件

未確定事項はコードへ埋め込まず、設定または docs に逃がすこと。

