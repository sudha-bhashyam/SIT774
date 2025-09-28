pipeline {
  agent any
  options { skipDefaultCheckout(true); timestamps() }
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
          if npm run | grep -q "build"; then npm run build; else echo "No build script"; fi
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
    stage('Test') { steps { echo 'Test' } }
    stage('Code Quality') { steps { echo 'Code Quality' } }
    stage('Security') { steps { echo 'Security' } }
    stage('Deploy (Staging)') { steps { echo 'Deploy' } }
    stage('Release (Prod)') { when { branch 'main' } steps { echo 'Release' } }
    stage('Monitoring & Alerts') { steps { echo 'Monitoring' } }
  }
  post {
    success { archiveArtifacts artifacts: 'dist/*.tar.gz', fingerprint: true, onlyIfSuccessful: true }
    always { echo 'Pipeline finished.' }
  }
}
