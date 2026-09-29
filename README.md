# FIRE Calculator

年齢・生活費・資産・積立額・年金・インフレ率から、Recent-based / Base / Conservative の3シナリオを比較する静的なFIRE試算ツールです。画面の **Investment Index / 運用指数** は3シナリオ共通で、別指数への暗黙のフォールバックは行いません。

## 市場データ

| 指数 | 実装 | 期間 | 種類 / 通貨 | 出典 |
|---|---|---:|---|---|
| S&P 500 | ローカル固定の月次履歴 | 1946-01〜2026-08 | 配当再投資込み名目Total Return / USD | [GaMa96/lfc-sp500-data, commit `ac66267d…`](https://github.com/GaMa96/lfc-sp500-data/tree/ac66267d99aaa0f88c41f93acabc639a9a4dd908) |
| MSCI ACWI | 公表設定来CAGRのみ | 1987-12-31〜2026-04-30 | Gross Return / USD | [MSCI ACWI factsheet](https://www.msci.com/documents/10199/255599/msci-acwi.pdf) |
| NASDAQ-100 | 公表設定来CAGRのみ | 1985-01-31〜2024-12-31 | Compound Return / USD | [Nasdaq 40周年資料](https://www.nasdaq.com/articles/nasdaq-100-indexr-celebrates-40-years-innovation) |

S&P 500の元系列は固定commitの `data/sp500.js` をリポジトリに保存し、同じ内容を `docs/sp500-data.js` からGitHub Pages実行時にローカル読込します。raw系列は1871-01〜2026-08（1868月次値）ですが、シミュレータでは従来互換のため1946-01以降を使用します。市場データについて実行時の外部依存はありません（Chart.jsやGoogle Fontsなどの一般ライブラリは外部配信を利用します）。

S&P 500はBase / Recent / Conservativeを利用できます。MSCI ACWIとNASDAQ-100はBaseのみ利用でき、Recent / Conservativeは「月次履歴未収録」と表示します。候補となる第三者月次データについて系列定義と公開リポジトリへの再配布許諾を確認できなかったため、ETF価格、生成・補間値を含めて収録していません。

## 計算定義

- **Base**: 月次履歴がある指数は履歴全期間のCAGRを使用し、「月次履歴から算出」と表示します。月次履歴未収録の指数は公表設定来CAGR（MSCI ACWI 8.82%、NASDAQ-100 14.25%）を使い、「公表設定来CAGR」と表示します。
- **Recent-based**: `H_years = 想定寿命 − 現在年齢`、`H_months = H_years × 12` とし、選択指数の末尾 `H_months` のCAGRをFIRE前に使用します。FIRE後は同じ指数のBase CAGRです。
- **Conservative**: 選択指数の月次リターン順序を保持し、FIRE開始から想定寿命までと同じ長さの全履歴窓を後ろ向きDPで評価します。必要元本が最大になる実績経路をWorst Pathとし、FIRE前は同じ指数のBase CAGRを使用します。
- 名目月次リターンを入力インフレ率で実質化し、生活費は現在価値で固定します。
- 年金は65歳開始時の入力額を基準に、60〜64歳は1か月0.4%減、66〜75歳は1か月0.7%増として月次キャッシュフローへ反映します。

データ自体がない場合は「月次履歴未収録」、必要な長さに満たない場合は「履歴期間不足」、値が不正な場合は「月次履歴エラー」と区別します。過去実績は将来の運用成果を保証しません。

## 使い方

`docs/index.html` をブラウザで開きます。ビルドは不要です。
