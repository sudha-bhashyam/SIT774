pipeline {
  agent any
  options { skipDefaultCheckout(true); timestamps() }
  environment {
    PATH = "/opt/homebrew/opt/node@18/bin:/opt/homebrew/bin:/usr/local/bin:${env.PATH}"
    PROD_PORT = '4000'
    NOTIFY_EMAIL = ''  // optional: set an email here to get alerts
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        echo "Checked out ${env.BRANCH_NAME} @ ${env.GIT_COMMIT}"
      }
    }

    stage('Build') {
      steps {
        sh '''
          set -eux
          node -v
          npm -v
          if [ -f package-lock.json ]; then npm ci; else npm install; fi
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

    stage('Test (Unit)') {
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
        always { junit 'reports/*.xml' }
      }
    }

    stage('Code Quality') {
      steps {
        sh '''
          set -eux
          mkdir -p reports
          npm run lint
          npm run dup
        '''
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'reports/eslint-junit.xml'
          archiveArtifacts artifacts: 'reports/jscpd/*.xml', fingerprint: true, allowEmptyArchive: true
        }
      }
    }

    stage('Security') {
  steps {
    sh '''
      set -eux
      mkdir -p reports
      # 1) Dependency audit (JSON)
      npm run sec_audit
      # 2) Retire.js (JSON)
      npm run sec_retire
      # 3) Summarize -> Markdown + exit 1 on High/Critical
      node tools/security-summary.js
    '''
  }
  post {
    always {
      archiveArtifacts artifacts: 'reports/npm-audit.json', allowEmptyArchive: true
      archiveArtifacts artifacts: 'reports/retire.json', allowEmptyArchive: true
      archiveArtifacts artifacts: 'reports/security-summary.md', allowEmptyArchive: true
    }
  }
}


    stage('Deploy (Staging)') {
      steps {
        sh '''
          set -eux
          rm -f .app.pid app.log || true
          PORT=3000 nohup npm run start > app.log 2>&1 &
          echo $! > .app.pid
          for i in $(seq 1 30); do
            if curl -sSf -o /dev/null http://127.0.0.1:3000/health; then
              echo "Staging app is up"
              exit 0
            fi
            sleep 1
          done
          echo "App did not come up on :3000"
          exit 1
        '''
      }
      post {
        always { archiveArtifacts artifacts: 'app.log', allowEmptyArchive: true }
      }
    }

    stage('Integration Test (Staging)') {
      steps {
        sh '''
          set -eux
          CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health)
          echo "Staging /health -> $CODE"
          test "$CODE" = "200"
        '''
      }
    }

    stage('Cleanup (Staging)') {
      steps {
        sh '''
          set -eux
          if [ -f .app.pid ]; then kill $(cat .app.pid) || true; rm -f .app.pid; fi
        '''
      }
    }

    stage('Release (Prod)') {
      when { branch 'main' }
      steps {
        sh '''
          set -eux
          rm -f .prod.pid prodapp.log || true
          PORT=''' + '${PROD_PORT}' + ''' nohup npm run start > prodapp.log 2>&1 &
          echo $! > .prod.pid
          for i in $(seq 1 30); do
            if curl -sSf -o /dev/null http://127.0.0.1:'''+ '${PROD_PORT}' + '''/health; then
              echo "Prod app is up on :''' + '${PROD_PORT}' + '''"
              exit 0
            fi
            sleep 1
          done
          echo "Prod did not come up"
          exit 1
        '''
      }
      post {
        always { archiveArtifacts artifacts: 'prodapp.log', allowEmptyArchive: true }
      }
    }

    stage('Monitoring & Alerts') {
      when { branch 'main' }
      steps {
        script {
          def ok = true
          for (int i=0; i<6; i++) { // ~30s quick monitor
            def rc = sh(returnStatus: true, script: 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:' + env.PROD_PORT + '/health')
            if (rc != 200) { ok = false; break }
            sleep 5
          }
          if (!ok) {
            echo "Prod health check failed"
            if (env.NOTIFY_EMAIL?.trim()) {
              try {
                mail to: env.NOTIFY_EMAIL, subject: "SIT774 prod health check FAILED", body: "Prod /health failed on port ${env.PROD_PORT}."
              } catch (e) {
                echo "Email not sent: ${e}"
              }
            }
            error("Monitoring detected an issue")
          } else {
            echo "Monitoring OK"
          }
        }
      }
      post {
        always {
          // stop prod app we started (demo environment)
          sh 'if [ -f .prod.pid ]; then kill $(cat .prod.pid) || true; rm -f .prod.pid; fi'
        }
      }
    }
  }

  post {
    success { archiveArtifacts artifacts: 'dist/*.tar.gz', fingerprint: true, onlyIfSuccessful: true }
    always { echo 'Pipeline finished.' }
  }
}
