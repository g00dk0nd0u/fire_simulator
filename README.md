# FIRE Calculator

年齢・生活費・資産・積立額・年金・インフレ率から、Recent-based / Base / Conservative の3シナリオを比較する静的なFIRE試算ツールです。

## 運用指数

画面の **Investment Index / 運用指数** は3シナリオ共通です。別指数への暗黙のフォールバックは行いません。

| 指数 | 採用系列 | 期間 | リターン種別 | 出典 | 月次履歴の収録状況 |
|---|---|---:|---|---|---|
| S&P 500 | `nomTRP` | 1946-01〜2026-08 | 配当再投資込み名目 Total Return | [GaMa96/lfc-sp500-data（commit `ac66267d…`）](https://github.com/GaMa96/lfc-sp500-data/tree/ac66267d99aaa0f88c41f93acabc639a9a4dd908) | 従来互換の固定CDN参照（ローカル化未完） |
| MSCI ACWI | MSCI ACWI Index (USD), Gross Returns | 1987-12-31〜2026-04-30 | Gross Return | [MSCI ACWI factsheet](https://www.msci.com/documents/10199/255599/msci-acwi.pdf) | **未収録**。factsheetの設定来CAGRのみ採用 |
| NASDAQ-100 | Nasdaq-100 Index | 1985-01-31〜2024-12-31 | Nasdaq公表の設定来 Compound Return | [Nasdaq 40周年資料](https://www.nasdaq.com/articles/nasdaq-100-indexr-celebrates-40-years-innovation) | **未収録**。資料の設定来CAGRのみ採用 |

`docs/market-data.js` に指数ID、symbol/code、通貨、期間、系列種別、出典メタデータを固定しています。月次系列がある場合、Base CAGRはその先頭・末尾から再計算し、公表CAGRの固定値は使いません。MSCI ACWIとNASDAQ-100について、検証可能な公式長期月次Total Return系列を取得できなかったため、ETF（ACWI/QQQ）の価格を代用していません。この2指数を選ぶとBaseは計算できますが、Recent-based / Conservativeは「履歴不足」と表示します。

## 月次系列の追加調査

- **NASDAQ-100:** Nasdaq公式Historyの Total Return Index **XNDX**（USD）とDownload機能を第一候補としました。Price IndexのNDXやQQQは代用対象外です。この実行環境では `indexes.nasdaqomx.com` / `api.nasdaq.com` への接続がHTTP proxyで拒否され、レスポンスおよび利用条件を検証できなかったため未収録です。
- **MSCI ACWI:** MSCI公式Index code **892400** の **Gross Return USD** を第一候補とし、Index page、download機能、公開データエンドポイントを対象にしました。公式factsheetでは設定来期間とCAGRは確認対象になりますが、長期月次Index Levelは含まれません。この実行環境では `www.msci.com` への接続が拒否され、download endpointと利用条件を検証できなかったため未収録です。Net Return/Price系列やACWI ETFは代用していません。
- **S&P 500:** 現行の固定commitにある配当再投資込み `nomTRP` のローカル化を試みましたが、GitHub/jsDelivrへの接続が同様に拒否されました。計算側では従来互換の1946-01フィルタを復元しています。

出典の真正性、系列種別、再配布条件を確認できない数値を生成・補間して収録することはしていません。

## 計算定義

- **Base**: 選択指数のローカル月次Index Levelの先頭・末尾から名目CAGRを再計算します。月次系列未収録時だけ、従来表示を維持するため公表CAGR（S&P 500 11.23%、MSCI ACWI 8.82%、NASDAQ-100 14.25%）を使用します。
- **Recent-based**: `H = 想定寿命 − 現在年齢` とし、選択指数の末尾Hか月だけからTotal Return CAGRを算出し、全FIRE候補のFIRE前資産形成に固定使用します。FIRE後の必要元本には同じ指数のBase CAGRを使います。Hか月に満たない場合は履歴不足です。
- **Conservative**: 選択指数の月次リターン順序を保持し、各FIRE候補から想定寿命までと同じ長さの全履歴窓を後ろ向きDPで評価します。必要元本が最大の実績経路をWorst Pathに採用します。FIRE前は同じ指数のBase CAGRを使用します。十分な窓がなければその候補は評価しません。
- **インフレ**: 名目月次リターンをユーザー入力のインフレ率で実質化し、生活費は現在価値で固定します（二重計上しません）。
- 年金は65歳開始時の入力額を基準に、60〜64歳は1か月0.4%減、66〜75歳は1か月0.7%増として月次キャッシュフローへ反映します。

指数ごとに利用可能な履歴期間は異なります。過去実績は将来の運用成果を保証しません。

## 使い方

`docs/index.html` をブラウザで開きます。ビルドは不要です。Chart.jsと、現時点ではS&P 500月次系列だけが外部CDN参照です。

## ファイル

- `docs/index.html`: UI
- `docs/app.js`: FIRE・年金・履歴窓・後ろ向きDP計算
- `docs/market-data.js`: 指数メタデータとBase前提
- `docs/style.css`, `docs/base-market.css`: スタイル
