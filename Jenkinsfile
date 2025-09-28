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


    

   
    

  post {
    success { archiveArtifacts artifacts: 'dist/*.tar.gz', fingerprint: true, onlyIfSuccessful: true }
    always { echo 'Pipeline finished.' }
  }
}
