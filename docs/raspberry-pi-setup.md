# Raspberry Pi セットアップ手順書

## 概要

Raspberry Pi 400 に receiver を設置し、USB 400J 経由で CWD-3-1 の電流データを
Supabase へ送信する常駐サービスを構築する。

## システム構成

```
CWD-3-1 (電流センサ)
    │ EnOcean 928MHz 無線
    ▼
USB 400J ──USB──> Raspberry Pi 400
                      │ WiFi → LTE ルータ → HTTPS
                      ▼
                  Supabase Edge Functions (telemetry-ingest)
```

## 前提条件

- Raspberry Pi 400 に Raspberry Pi OS がインストール済み
- SSH 接続が可能
- WiFi で LTE ルータに接続済み（インターネット到達可能）
- USB 400J と CWD-3-1 が手元にある

## セットアップ手順

### 1. SSH でラズパイに接続

```bash
ssh pi@<ラズパイのIPアドレス>
```

### 2. セットアップスクリプトを実行

```bash
git clone https://github.com/solomakers/machining-current-monitor.git
cd machining-current-monitor
bash scripts/setup-receiver.sh
```

スクリプトが自動で以下を実行:
- システムパッケージ更新
- Node.js 22 LTS インストール（nvm 経由）
- 依存関係インストール
- udev ルール設定（USB 400J → `/dev/enocean-usb400j`）
- systemd サービス登録

### 3. 環境変数を設定

```bash
nano ~/machining-current-monitor/apps/receiver/.env
```

以下を実際の値に変更:

```
SERIAL_PORT=/dev/enocean-usb400j
SERIAL_BAUD_RATE=57600
GATEWAY_ID=gw-tokyo-001
INGEST_API_BASE_URL=https://hqqyhoetophdzndnfdda.supabase.co/functions/v1
INGEST_API_TOKEN=<ゲートウェイトークン>
HEARTBEAT_INTERVAL_SEC=60
SPOOL_DIR=./spool
LOG_LEVEL=info
```

### 4. USB 400J を接続して確認

```bash
# USB 400J をラズパイの USB-A ポートに挿す
ls -l /dev/enocean-usb400j
```

`/dev/enocean-usb400j -> ttyUSB0` のようにシンボリックリンクが表示されれば OK。

表示されない場合:
```bash
# デバイス一覧を確認
ls /dev/ttyUSB*
# udev ルールを再読み込み
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### 5. サービスを起動

```bash
sudo systemctl start mcm-receiver
```

### 6. 動作確認

```bash
# ログをリアルタイム表示
journalctl -u mcm-receiver -f

# サービス状態の確認
sudo systemctl status mcm-receiver
```

正常時のログ例:
```
[INFO] Receiver started. Gateway: gw-tokyo-001
[INFO] Serial port opened: /dev/enocean-usb400j
[INFO] ESP3 packet received from 01-02-03-04
[INFO] Telemetry sent: 1 inserted, 0 duplicated
```

### 7. フロントエンドで確認

ブラウザで https://machining-monitor-solomakers.vercel.app にアクセスし、
ダッシュボードにデータが表示されることを確認する。

## 運用コマンド

```bash
# サービス停止
sudo systemctl stop mcm-receiver

# サービス再起動
sudo systemctl restart mcm-receiver

# 自動起動の無効化
sudo systemctl disable mcm-receiver

# スプール件数の確認
wc -l ~/machining-current-monitor/apps/receiver/spool/spool.jsonl
```

## トラブルシューティング

### USB 400J が認識されない

```bash
# USB デバイスの一覧
lsusb
# FTDI FT232R (0403:6001) が表示されるか確認

# カーネルログ
dmesg | tail -20
```

VID/PID が異なる場合は `deploy/99-usb400j.rules` を修正する。

### サービスが起動しない

```bash
# 詳細ログ
journalctl -u mcm-receiver --no-pager -n 50

# .env の確認
cat ~/machining-current-monitor/apps/receiver/.env

# 手動実行でエラー確認
cd ~/machining-current-monitor/apps/receiver
node --import tsx src/index.ts
```

### データが Supabase に届かない

```bash
# HTTPS 疎通確認
curl -s https://hqqyhoetophdzndnfdda.supabase.co/functions/v1/telemetry-ingest \
  -H "Authorization: Bearer <トークン>" \
  -H "Content-Type: application/json" \
  -d '{"gatewayId":"gw-tokyo-001","sentAt":"2026-01-01T00:00:00Z","samples":[]}'

# スプールにデータが溜まっていないか
ls -la ~/machining-current-monitor/apps/receiver/spool/
```

### WiFi が切れた場合

receiver はスプールにデータを蓄積し、接続回復後に自動再送する。
24時間以上のオフライン蓄積に対応。

```bash
# WiFi 状態確認
iwconfig wlan0

# WiFi 再接続
sudo wpa_cli -i wlan0 reconfigure
```

### サービスのメモリ使用量が多い

```bash
# メモリ使用量確認
systemctl status mcm-receiver | grep Memory

# 上限は receiver.service で 256MB に制限済み
```
