# 工場設置手順書

## 持ち物チェックリスト

- [ ] Raspberry Pi 4B（セットアップ済み）
- [ ] USB-C電源アダプタ
- [ ] USB 400J（EnOcean受信機）
- [ ] CWD-3-1（電流センサ）+ CTクランプ
- [ ] WiFiルータ（工場に設置するもの）+ SIMカード
- [ ] LANケーブル（初期設定用、WiFi不安定な場合の予備）
- [ ] ノートPC（SSH接続用）
- [ ] HDMIケーブル + モニター（トラブル時の予備、なくてもOK）

---

## 設置手順

### Step 1: WiFiルータを設置

1. LTEルータ（aterm-338413）の電源を入れる
2. ラズパイは同じSSIDに接続済みなのでWiFi設定変更は不要

### Step 2: ラズパイの電源を入れる

1. USB 400Jをラズパイの**USB-Aポート**に挿す
2. USB-C電源アダプタを接続 → 自動起動
3. 1-2分待つ（起動 → WiFi接続 → receiverサービス自動起動）

### Step 3: USB 400J の認識確認

SSHでラズパイに接続（ノートPCも同じWiFiルータに接続）：
```bash
ssh pi@192.168.179.5
```

USB 400Jの認識確認：
```bash
ls -l /dev/enocean-usb400j
```
`/dev/enocean-usb400j -> ttyUSB0` と表示されればOK

### Step 4: CWD-3-1を設備に取り付け

1. 測定対象の電線にCTクランプを取り付け
   - L1: R相（赤線）
   - L2: S相（白線）
   - L3: T相（青線）※三相の場合
2. CTクランプの向き（矢印）を電流の流れる方向に合わせる
3. CWD-3-1本体のLEDが点灯するか確認（最小動作電流: 2A以上必要）

### Step 5: サービスを起動して確認

```bash
sudo systemctl restart mcm-receiver
```

30秒待ってからログ確認：
```bash
journalctl -u mcm-receiver --since "1 min ago" --no-pager
```

正常なら以下のようなログが出る：
```
Telemetry sample {"deviceId":"XX-XX-XX-XX","l1":10.5,"l2":9.8,"l3":null}
Ingest successful {"inserted":1,"duplicated":0}
```

### Step 6: ダッシュボードで確認

ブラウザで https://machining-monitor.vercel.app にアクセス
- ログイン: admin@machining-monitor.local / McmAdmin2026!
- 設備一覧にデータが表示されていればOK

---

## 設置後の確認項目

- [ ] CWD-3-1のLED点灯（30秒間隔で点滅）
- [ ] USB 400J認識（`/dev/enocean-usb400j`が存在）
- [ ] receiverサービス稼働中（`systemctl status mcm-receiver`）
- [ ] ダッシュボードにデータ表示
- [ ] 電流値がクランプメーター実測値と概ね一致

---

## トラブルシューティング

### CWD-3-1のLEDが光らない
→ 最小動作電流2A未満。設備を稼働させてから確認

### receiverが起動しない
```bash
# ログ確認
journalctl -u mcm-receiver --no-pager -n 30

# 古いプロセスが残っていないか確認
ps aux | grep node | grep -v grep

# 残っていたら全停止して再起動
sudo killall node; sleep 2; sudo systemctl restart mcm-receiver
```

### データがSupabaseに届かない
```bash
# インターネット接続確認
ping -c 3 google.com

# スプールにデータが溜まっていないか（WiFi切断中のデータ）
ls -la ~/machining-current-monitor/apps/receiver/spool/
```
→ WiFi復旧後、スプールのデータは自動再送される

### 電波が届かない（CRCエラー多発）
→ USB 400Jを延長ケーブルでCWD-3-1に近づける（5m以内推奨）

---

## 撤収手順（持ち帰る場合）

```bash
sudo systemctl stop mcm-receiver
sudo shutdown -h now
```
緑LEDが消灯してから電源を抜く
