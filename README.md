# ⭐ Star Chart — Setup Guide

A complete kids chore & star tracking system for Amazon Echo Show with a companion PWA.

## What You're Getting

| Component | Purpose |
|-----------|---------|
| `lambda-skill/` | Alexa Skill Lambda — voice interaction + APL visuals on Echo Show |
| `lambda-api/` | REST API Lambda — backend for the companion PWA |
| `companion-pwa/` | Mobile-friendly web app — manage kids, chores, star goals |
| `infrastructure/` | CloudFormation template — deploys all AWS resources automatically |

---

## Prerequisites

- **AWS account** (free tier is sufficient)
- **Amazon Developer account** (free) — developer.amazon.com
- **AWS CLI** installed and configured (`aws configure`)
- **Node.js 18+** installed

---

## Step 1 — Deploy AWS Infrastructure

This creates DynamoDB, both Lambda functions, and API Gateway in one command.

```bash
cd infrastructure

aws cloudformation deploy \
  --template-file cloudformation.yaml \
  --stack-name star-chart \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides AlexaSkillId=amzn1.ask.skill.YOUR-SKILL-ID-HERE
```

> **Note:** You'll update the Alexa Skill ID after Step 2. For now, deploy with the placeholder — you can update the stack later.

After deploy, grab the outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name star-chart \
  --query 'Stacks[0].Outputs'
```

Save these three values:
- `ApiEndpoint` — goes into the PWA
- `SkillLambdaArn` — goes into Alexa Developer Console
- `DynamoTableName` — for reference

---

## Step 2 — Create the Alexa Skill

1. Go to [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask)
2. Click **Create Skill**
3. Name it **"Star Chart"**, choose **Custom** model, **Provision your own** hosting
4. Under **Endpoint**, select **AWS Lambda ARN** and paste your `SkillLambdaArn`
5. Go to **JSON Editor** in the Interaction Model section and paste the contents of `lambda-skill/interaction-model.json`
6. Click **Save Model** then **Build Model**
7. Copy your **Skill ID** (starts with `amzn1.ask.skill.`)

Update the CloudFormation stack with your real Skill ID:

```bash
aws cloudformation deploy \
  --template-file cloudformation.yaml \
  --stack-name star-chart \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides AlexaSkillId=amzn1.ask.skill.YOUR-REAL-SKILL-ID
```

---

## Step 3 — Deploy Lambda Code

### Skill Lambda

```bash
cd lambda-skill
npm install
zip -r ../skill-deploy.zip .
aws lambda update-function-code \
  --function-name StarChartSkill \
  --zip-file fileb://../skill-deploy.zip
```

### API Lambda

```bash
cd lambda-api
npm install
zip -r ../api-deploy.zip .
aws lambda update-function-code \
  --function-name StarChartAPI \
  --zip-file fileb://../api-deploy.zip
```

---

## Step 4 — Host the Companion PWA

### Option A: GitHub Pages (Recommended — Free)

```bash
cd companion-pwa
git init
git add .
git commit -m "Star Chart PWA"
gh repo create star-chart-pwa --public --push --source .
# Enable GitHub Pages in repo Settings > Pages > Deploy from main branch
```

Your PWA will be at: `https://YOUR-USERNAME.github.io/star-chart-pwa`

### Option B: AWS S3 Static Hosting

```bash
aws s3 mb s3://star-chart-pwa-YOUR-NAME
aws s3 website s3://star-chart-pwa-YOUR-NAME --index-document index.html
aws s3 cp companion-pwa/ s3://star-chart-pwa-YOUR-NAME/ --recursive --acl public-read
```

### Option C: Just open index.html locally

For quick testing, just open `companion-pwa/index.html` directly in your phone's browser.

---

## Step 5 — Connect the PWA

1. Open the PWA URL on your phone or in the Alexa app browser
2. Paste your `ApiEndpoint` URL when prompted
3. Add your two kids via the **+** button
4. Set their chores and star goals
5. Install as PWA: tap **Share → Add to Home Screen** in Safari/Chrome

---

## Step 6 — Customize Child Names in Alexa

Edit `lambda-skill/interaction-model.json` — update the `CHILD_NAMES` slot values with your actual kids' names, rebuild the model in the Alexa console, and redeploy.

---

## Voice Commands

| Say... | What happens |
|--------|-------------|
| "Alexa, open Star Chart" | Shows dashboard with both kids' stars |
| "Show all stars" | Displays the ambient side-by-side view |
| "Give Emma a star" | Adds a star, announces progress |
| "Emma finished brushing teeth" | Marks chore complete + adds star |
| "Show Liam's stars" | Reports current star count |
| "Reset Emma's chores" | Clears today's completed chores |

---

## Echo Show Ambient Display

After opening Star Chart, the APL visual stays on screen showing:
- Both kids' names and emoji
- Current star count / goal
- Animated gold progress bar
- Percentage to next reward

---

## Reward Flow

1. Child earns stars toward their goal (default: 10)
2. On the final star — Alexa announces celebration, Echo Show shows a party screen
3. Reward date is logged with timestamp in DynamoDB
4. Stars automatically reset to 0 for the next goal
5. All reward history is visible in the PWA **History** tab

---

## Troubleshooting

**"No children found"** — Make sure you've added kids via the PWA and the API URL is correct.

**Lambda timeout** — Increase Lambda timeout to 10s in the AWS Console if DynamoDB is slow.

**CORS errors in PWA** — The CloudFormation template sets `AllowOrigins: '*'`. If you restrict this, add your PWA domain.

**Skill not responding** — Check CloudWatch logs for the `StarChartSkill` Lambda function.

---

## Cost Estimate

All within **AWS free tier** for typical family usage:
- DynamoDB: ~$0/month (well under 25GB / 25 capacity units free)
- Lambda: ~$0/month (well under 1M free requests/month)
- API Gateway: ~$0/month (well under 1M free requests/month)

Total expected cost: **$0/month** 🎉
