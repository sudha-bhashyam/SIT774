pipeline {
  agent any
  options { skipDefaultCheckout(true); timestamps() }

  environment {
    PATH = "/opt/homebrew/opt/node@18/bin:/opt/homebrew/bin:/usr/local/bin:${env.PATH}"
    APP_PORT = '3000'
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        echo "Checked out ${env.BRANCH_NAME} @ ${sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()}"
      }
    }

    stage('Build') {
      steps {
        sh '''
          set -eux
          node -v
          npm -v

          if [ -f package-lock.json ]; then npm ci; else npm install; fi

          if npm run | grep -q "build"; then
            npm run build
          else
            echo "No build script"
          fi

          mkdir -p dist
          rm -rf .pack && mkdir .pack
          rsync -a --exclude ".git" --exclude "dist" --exclude "node_modules" . .pack/
          SHORT_COMMIT=$(git rev-parse --short HEAD || echo local)
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
          junit 'reports/*.xml'
        }
      }
    }

    stage('Code Quality') {
      steps {
        sh '''
          set -eux
          mkdir -p reports
          # Produce ESLint JUnit/JSON as your earlier jobs did
          eslint . --ext .js --format junit -o reports/eslint-junit.xml || true
          # jscpd duplication
          jscpd --pattern "**/*.js" --ignore "**/node_modules/**,**/dist/**,**/.pack/**,**/reports/**" --reporters xml --output reports/jscpd || true
        '''
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/eslint-junit.xml'
          archiveArtifacts artifacts: 'reports/jscpd/jscpd-report.xml', fingerprint: true, allowEmptyArchive: true
        }
      }
    }

    stage('Security') {
      steps {
        sh '''
          set -eux
          mkdir -p reports
          npm run sec_audit || true
          npm run sec_retire || true
          node tools/security-summary.js || true
          echo "Security summary written to reports/security-summary.md | failOnHighOrCritical = false"
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/npm-audit.json', fingerprint: true, allowEmptyArchive: true
          archiveArtifacts artifacts: 'reports/retire.json', fingerprint: true, allowEmptyArchive: true
          archiveArtifacts artifacts: 'reports/security-summary.md', fingerprint: true, allowEmptyArchive: true
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
          for i in $(seq 1 60); do
            if curl -fsS http://127.0.0.1:${APP_PORT}/health >/dev/null; then
              echo "App is up on :${APP_PORT}"
              break
            fi
            sleep 1
          done
          curl -fsS http://127.0.0.1:${APP_PORT}/health
          docker compose logs --no-color > reports/staging-logs.txt || true
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/staging-logs.txt', fingerprint: true
          sh 'docker compose ps || true'
        }
      }
    }

    stage('Integration Test (Staging)') {
      steps {
        sh '''
          set -eux
          curl -fsS http://127.0.0.1:${APP_PORT}/health | tee reports/deploy-health.json
          node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('reports/deploy-health.json','utf8')); if(d.status!=='ok'){process.exit(1)}"
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/deploy-health.json', fingerprint: true
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
      when { branch 'main' }
      steps {
        echo 'Release'
      }
    }

    stage('Monitoring & Alerts') {
      steps {
        echo 'Monitoring'
      }
    }
  }

  post {
    success {
      archiveArtifacts artifacts: 'dist/*.tar.gz', fingerprint: true, onlyIfSuccessful: true
    }
    always {
      echo 'Pipeline finished.'
    }
  }
}
