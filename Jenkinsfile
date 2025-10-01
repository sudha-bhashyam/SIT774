pipeline {
  agent any
  options { timestamps() }
  environment {
    PATH = "/opt/homebrew/opt/node@18/bin:/opt/homebrew/bin:/usr/local/bin:${env.PATH}"
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
          rm -rf .pack
          mkdir .pack
          rsync -a --exclude .git --exclude dist --exclude node_modules . .pack/
          SHORT_COMMIT=$(git rev-parse --short HEAD)
          TAR=dist/sit774-nodeapp-${SHORT_COMMIT}.tar.gz
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
      npm run lint
      npm run lint:json
      npm run dup
      npm run dup:json
      node tools/quality-gates.js || echo QUALITY_FAIL=1 > reports/QUALITY_FAIL
      rm -f reports/quality-gate.*   # clear old markers
      npm run lint || true
      npm run lint:json || true
      npm run dup || true
      npm run dup:json || true
      node tools/quality-gates.js || true
    '''
  }
  post {
    always {
      // ESLint (JUnit) so it shows nicely in Jenkins
      junit allowEmptyResults: true, testResults: 'reports/eslint-junit.xml'
      // Archive raw reports for evidence
      archiveArtifacts artifacts: 'reports/eslint.json, reports/jscpd/jscpd-report.json, reports/jscpd/jscpd-report.xml', allowEmptyArchive: true, fingerprint: true

      // Mark UNSTABLE if threshold breach (non-fatal)
      // ESLint JUnit file may not exist on some runs; don't warn loudly
      junit testResults: 'reports/eslint-junit.xml', allowEmptyResults: true
      archiveArtifacts artifacts: 'reports/**/*', fingerprint: true
      script {
        if (fileExists('reports/QUALITY_UNSTABLE')) {
        if (fileExists('reports/quality-gate.FAILURE')) {
          error 'Quality gate failed.'
        } else if (fileExists('reports/quality-gate.UNSTABLE')) {
          currentBuild.result = 'UNSTABLE'
          echo 'Marked build UNSTABLE due to quality gates.'
        }
        if (fileExists('reports/QUALITY_FAIL')) {
          error('Quality gate failure — see logs.')
        } else {
          echo 'Quality gates passed.'
        }
      }
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
      export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1

      # Clean any previous compose stack, then build+run
      docker compose down -v || true
      docker compose up -d --build

      # Wait until app responds
      for i in $(seq 1 60); do
        if curl -fsS http://127.0.0.1:3000/health >/dev/null; then
          echo "App is up on :3000"
          break
        fi
        sleep 1
      done

      # Confirm once more (fail if not up)
      curl -fsS http://127.0.0.1:3000/health >/dev/null

      # Save logs for troubleshooting
      docker compose logs --no-color > app.log || true
    '''
  }
  post {
    always {
      archiveArtifacts artifacts: 'app.log', fingerprint: true, allowEmptyArchive: true
      sh 'docker compose ps || true'
    }
  }
}

stage('Integration Test (Staging)') {
  steps {
    sh '''
      set -eux
      # Simple black-box check against the running container
      curl -fsS http://127.0.0.1:3000/health | tee reports/deploy-health.json
      # Optionally assert body contains {"status":"ok"}
      node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('reports/deploy-health.json','utf8')); if(d.status!=='ok'){process.exit(1)}"
    '''
  }
  post {
    always {
      archiveArtifacts artifacts: 'reports/deploy-health.json', allowEmptyArchive: false
    }
  }
}

stage('Cleanup (Staging)') {
  steps {
    sh 'docker compose down -v || true'
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
    always {
      echo 'Pipeline finished.'
      archiveArtifacts artifacts: 'dist/*.tar.gz', fingerprint: true
    }
  }
}
