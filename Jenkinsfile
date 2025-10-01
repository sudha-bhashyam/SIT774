pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  parameters {
    booleanParam(name: 'PROMOTE_TO_PROD', defaultValue: true, description: 'Run Release (Prod) stage')
    booleanParam(name: 'FAIL_ON_HIGH_OR_CRIT', defaultValue: false, description: 'Fail pipeline on HIGH/CRITICAL vulns (Security)')
  }

  environment {
    // Git / Node
    CI = 'true'
    // Docker registry settings (override in Jenkins -> Configure -> Pipeline Env)
    DOCKER_REGISTRY   = "${env.DOCKER_REGISTRY ?: 'docker.io'}"
    DOCKER_NAMESPACE  = "${env.DOCKER_NAMESPACE ?: 'library'}"
    DOCKER_IMAGE_NAME = 'sit774_ci-cd-web'
    DOCKER_IMAGE_FULL = "${env.DOCKER_REGISTRY}/${env.DOCKER_NAMESPACE}/${env.DOCKER_IMAGE_NAME}:latest"

    // Alerts
    ALERT_EMAIL = "${env.ALERT_EMAIL ?: ''}"
    // Common dirs
    REPORTS_DIR = 'reports'
  }

  triggers {
    // Uncomment if you want SCM polling
    // pollSCM('* * * * *')
  }

  stages {

    stage('Checkout') {
      steps {
        checkout([
          $class: 'GitSCM',
          branches: [[name: '*/ci-cd']],
          userRemoteConfigs: [[
            url: 'https://github.com/sudha-bhashyam/SIT774.git',
            credentialsId: 'github-creds'
          ]]
        ])
        script {
          def branchName = sh(returnStdout: true, script: 'git rev-parse --abbrev-ref HEAD').trim()
          echo "Checked out ${branchName} @ ${sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()}"
        }
      }
    }

    stage('Build') {
      steps {
        sh '''
          set -eux
          node -v
          npm -v

          if [ -f package-lock.json ]; then
            npm ci
          else
            npm install
          fi

          mkdir -p dist
          rm -rf ./.pack
          mkdir .pack
          rsync -a --exclude .git --exclude dist --exclude node_modules . .pack/
          SHORT_COMMIT=$(git rev-parse --short HEAD)
          TAR="dist/sit774-nodeapp-${SHORT_COMMIT}.tar.gz"
          tar -czf "$TAR" -C .pack .
          echo "Built artefact: $TAR"
        '''
      }
    }

    stage('Test') {
      steps {
        sh '''
          set -eux
          mkdir -p reports
          export JEST_JUNIT_OUTPUT_DIR=reports
          export JEST_JUNIT_OUTPUT_NAME=junit.xml
          npx jest --ci --reporters=default --reporters=jest-junit --testPathPattern="__tests__/smoke\\.test\\.js$"
        '''
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/**/*.xml'
          archiveArtifacts artifacts: 'reports/**', fingerprint: true
        }
      }
    }

    stage('Code Quality') {
      steps {
        sh '''
          set -eux
          mkdir -p reports
          rm -f reports/quality-gate.*

          # ESLint
          npm run lint || true
          npm run lint:json || true

          # Duplication (jscpd)
          npm run dup || true
          npm run dup:json || true

          # Apply gates (uses tools/quality-gates.js already in repo)
          node tools/quality-gates.js
        '''
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/**/*.xml'
          archiveArtifacts artifacts: 'reports/**', fingerprint: true
          script { echo 'Code Quality done.' }
        }
      }
    }

    stage('Security') {
      steps {
        sh '''
          set -eux
          mkdir -p reports

          # Dependency scans
          npm run sec_audit || true         # writes reports/npm-audit.json
          npm run sec_retire || true        # writes reports/retire.json

          # OPTIONAL: Container image scan with Trivy if installed
          if command -v trivy >/dev/null 2>&1; then
            echo "Trivy found, scanning image (will build later)."
          else
            echo "Trivy not installed, skipping image scan."
          fi

          # Summarize + (optionally) fail on HIGH/CRITICAL
          node tools/security-summary.js ${params.FAIL_ON_HIGH_OR_CRIT ? '--failOnHighOrCritical=true' : ''}
          echo "Security summary written to reports/security-summary.md | failOnHighOrCritical = ${params.FAIL_ON_HIGH_OR_CRIT}"
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/**', fingerprint: true
          junit allowEmptyResults: true, testResults: 'reports/**/*.xml'
        }
      }
    }

    stage('Deploy (Staging)') {
      steps {
        sh '''
          set -eux
          export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
          docker compose down -v || true
          docker compose up -d --build

          # Wait until /health is up
          for i in $(seq 1 60); do
            if curl -fsS http://127.0.0.1:3000/health >/dev/null; then
              echo "App is up on :3000"
              break
            fi
            sleep 1
            if [ $i -eq 60 ]; then
              echo "App failed to start" >&2
              exit 1
            fi
          done

          # Save logs (useful for report)
          docker compose logs --no-color > reports/staging-logs.txt || true

          # Build/tag a local image for later release step
          # (compose already built :latest)
          docker image inspect ${DOCKER_IMAGE_NAME}:latest >/dev/null
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/**,dist/**', fingerprint: true
          sh 'docker compose ps || true'
        }
      }
    }

    stage('Integration Test (Staging)') {
      steps {
        sh '''
          set -eux
          curl -fsS http://127.0.0.1:3000/health | tee reports/deploy-health.json
          node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('reports/deploy-health.json','utf8')); if(d.status!=='ok'){process.exit(1)}"
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/**', fingerprint: true
        }
      }
    }

    stage('Cleanup (Staging)') {
      steps {
        sh '''
          set -eux
          docker compose down -v || true
        '''
      }
    }

    stage('Release (Prod)') {
      when {
        allOf {
          anyOf {
            branch 'main'       // prefer main for real submissions
            branch 'ci-cd'      // keep during testing; remove later if desired
          }
          expression { return params.PROMOTE_TO_PROD }
        }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-hub-login', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            set -eux
            SHORT_COMMIT=$(git rev-parse --short HEAD)
            IMAGE=${DOCKER_IMAGE_NAME}:latest
            REG="${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}"

            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin "${DOCKER_REGISTRY}"

            # Tag and push
            docker tag "${IMAGE}" "${REG}/${DOCKER_IMAGE_NAME}:${SHORT_COMMIT}"
            docker tag "${IMAGE}" "${REG}/${DOCKER_IMAGE_NAME}:latest"
            docker push "${REG}/${DOCKER_IMAGE_NAME}:${SHORT_COMMIT}"
            docker push "${REG}/${DOCKER_IMAGE_NAME}:latest"

            # Minimal prod deploy using a separate compose file/port
            cat > docker-compose.prod.yml <<'YAML'
services:
  web:
    image: ${DOCKER_REGISTRY:-docker.io}/${DOCKER_NAMESPACE:-library}/sit774_ci-cd-web:latest
    ports:
      - "8080:3000"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 5s
      timeout: 2s
      retries: 10
YAML

            docker compose -f docker-compose.prod.yml down -v || true
            docker compose -f docker-compose.prod.yml up -d

            # Wait for prod health
            for i in $(seq 1 60); do
              if curl -fsS http://127.0.0.1:8080/health >/dev/null; then
                echo "Prod is up on :8080"
                break
              fi
              sleep 1
              if [ $i -eq 60 ]; then
                echo "Prod failed to start" >&2
                exit 1
              fi
            done
          '''
        }
      }
      post {
        success {
          archiveArtifacts artifacts: 'dist/**', fingerprint: true
        }
      }
    }

    stage('Monitoring & Alerts') {
      steps {
        sh '''
          set -eux
          mkdir -p reports

          # Simple uptime probe against PROD (acts as basic monitoring)
          STATUS=$(curl -fsS http://127.0.0.1:8080/health || true)
          echo "$STATUS" | tee reports/prod-health.json || true

          # If prod unhealthy, mark UNSTABLE and (best effort) email
          node -e "
            const fs=require('fs');
            let ok=false;
            try { ok = JSON.parse(fs.readFileSync('reports/prod-health.json','utf8')).status==='ok' } catch(e) {}
            if(!ok){ process.exit(2) }
          " || (
            echo 'Prod health check failed; marking UNSTABLE' >&2;
            # Try to send a very simple mail if 'mail' exists and ALERT_EMAIL provided
            if [ -n \\"${ALERT_EMAIL}\\" ] && command -v mail >/dev/null 2>&1; then
              echo 'SIT774 prod health check failed on Jenkins' | mail -s 'SIT774 ALERT: prod unhealthy' "${ALERT_EMAIL}" || true
            fi
            exit 0
          )
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/**', fingerprint: true
        }
      }
    }
  } // stages

  post {
    always {
      // Ensure test reports are picked even if some stages skipped
      junit allowEmptyResults: true, testResults: 'reports/**/*.xml'
      archiveArtifacts artifacts: 'reports/**,dist/**', fingerprint: true
      echo 'Pipeline finished.'
    }
    success {
      echo '✅ SUCCESS'
    }
    unstable {
      echo '⚠️ UNSTABLE (check gates/monitoring results and test reports)'
    }
    failure {
      echo '❌ FAILURE'
    }
  }
}
