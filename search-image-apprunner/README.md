# Search Image MCP - AWS App Runner

Unsplash画像検索機能を提供するMCPサーバーのAWS App Runner実装です。

## ディレクトリ構成

```
search-image-apprunner/
├── server.ts           # メインサーバー実装
├── package.json        # Node.js依存関係
├── tsconfig.json       # TypeScript設定
├── Dockerfile          # Dockerコンテナ設定
├── apprunner.yaml      # App Runner設定ファイル
├── .dockerignore       # Docker除外ファイル
├── .env.example        # 環境変数サンプル
└── README.md           # このファイル
```

## 必要な環境

- AWS アカウント
- AWS CLI 設定済み
- Docker（ローカルテスト用）
- Node.js 20以上
- Unsplash APIアクセスキー

## セットアップ手順

### 1. Unsplash APIキーの取得

1. [Unsplash Developers](https://unsplash.com/developers)にアクセス
2. アカウントを作成してアプリケーションを登録
3. Access Keyを取得

### 2. ローカル環境での確認

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してUNSPLASH_ACCESS_KEYを設定

# TypeScriptのビルド
npm run build

# ローカルでの起動
npm start
```

ヘルスチェック確認:
```bash
curl http://localhost:8080/health
```

## AWS App Runnerへのデプロイ

### 方法1: AWS コンソールを使用

1. **ECRリポジトリの作成**
```bash
aws ecr create-repository --repository-name search-image-mcp-apprunner --region ap-northeast-1
```

2. **Dockerイメージのビルドとプッシュ**
```bash
# ECRへのログイン
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin [AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com

# イメージのビルド
docker build --platform linux/amd64 -t search-image-mcp-apprunner .

# タグ付け
docker tag search-image-mcp-apprunner:latest [AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com/search-image-mcp-apprunner:latest

# プッシュ
docker push [AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com/search-image-mcp-apprunner:latest
```

3. **App Runnerサービスの作成**
- AWS App Runnerコンソールにアクセス
- 「Create service」をクリック
- Source: Container registry -> Amazon ECR
- ECRリポジトリとイメージを選択
- Deployment settings:
  - Manual または Automatic
- Service settings:
  - Service name: `search-image-mcp-apprunner`
  - CPU: 0.25 vCPU
  - Memory: 0.5 GB
  - Environment variables:
    - `UNSPLASH_ACCESS_KEY`: あなたのAPIキー
    - `PORT`: 8080
  - ヘルスチェックエンドポイントの設定
    - `/health`
- 「Create & deploy」をクリック

### 方法2: AWS CLIを使用

1. **設定ファイルの作成**

`apprunner-service.json`:
```json
{
  "ServiceName": "search-image-mcp-apprunner",
  "SourceConfiguration": {
    "ImageRepository": {
      "ImageIdentifier": "[AWS_ACCOUNT_ID].dkr.ecr.ap-northeast-1.amazonaws.com/search-image-mcp-apprunner:latest",
      "ImageConfiguration": {
        "Port": "8080",
        "RuntimeEnvironmentVariables": {
          "UNSPLASH_ACCESS_KEY": "YOUR_API_KEY_HERE",
          "PORT": "8080"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": false
  },
  "InstanceConfiguration": {
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }
}
```

2. **サービスの作成**
```bash
aws apprunner create-service --cli-input-json file://apprunner-service.json --region ap-northeast-1
```

### 方法3: apprunner.yamlを使用（ソースコードリポジトリ経由）

GitHubリポジトリと連携する場合は、`apprunner.yaml`ファイルが自動的に使用されます。

1. GitHubにコードをプッシュ
2. App RunnerコンソールでGitHub連携を設定
3. 自動的にビルドとデプロイが実行される

## Claude Desktopでの設定

デプロイ完了後、App Runnerが提供するURLを使用してClaude Desktopのコネクタを追加します。


## 環境変数の更新

App Runnerコンソールまたは CLI で環境変数を更新できます:

```bash
aws apprunner update-service \
  --service-arn "arn:aws:apprunner:ap-northeast-1:[ACCOUNT_ID]:service/search-image-mcp-apprunner/[SERVICE_ID]" \
  --source-configuration '{
    "ImageRepository": {
      "ImageConfiguration": {
        "RuntimeEnvironmentVariables": {
          "UNSPLASH_ACCESS_KEY": "NEW_API_KEY",
          "PORT": "8080"
        }
      }
    }
  }'
```

## モニタリング

- CloudWatch Logsでログを確認
- App Runnerコンソールでメトリクスを監視
- ヘルスチェックエンドポイント: `/health`

## トラブルシューティング

### サービスが起動しない
- CloudWatch Logsでエラーログを確認
- 環境変数が正しく設定されているか確認
- Dockerイメージが正しくビルドされているか確認

### API呼び出しが失敗する
- UNSPLASH_ACCESS_KEYが正しいか確認
- Unsplash APIの利用制限に達していないか確認

### ヘルスチェックが失敗する
- `/health`エンドポイントが正しく実装されているか確認
- ポート8080が正しく設定されているか確認

## コスト最適化のヒント

- 開発環境では最小スペック（0.25 vCPU, 0.5 GB）を使用
- Auto Scalingの設定を適切に調整
- 不要時はサービスを一時停止

## セキュリティの考慮事項

- APIキーは環境変数として設定し、コードにハードコードしない
- 本番環境ではAWS Secrets Managerの使用を検討
- VPCコネクタを使用してプライベートネットワーク内のリソースにアクセス