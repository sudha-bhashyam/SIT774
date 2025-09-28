pipeline {
  agent any
  options {
    skipDefaultCheckout(true)
    timestamps()
  }
  stages {
    stage('Checkout') {
      steps {
        checkout scm
        echo 'Checked out source code'
      }
    }
    stage('Build') {
      steps {
        echo 'Build: (will install deps and build artefact in the next step)'
      }
    }
    stage('Test') {
      steps {
        echo 'Test: (will run automated tests next)'
      }
    }
    stage('Code Quality') {
      steps {
        echo 'Code Quality: (SonarQube/CodeClimate to be added)'
      }
    }
    stage('Security') {
      steps {
        echo 'Security: (Dependency/Code scans to be added)'
      }
    }
    stage('Deploy (Staging)') {
      steps {
        echo 'Deploy: (start app in a test environment next)'
      }
    }
    stage('Release (Prod)') {
      when { branch 'main' }
      steps {
        echo 'Release: (promote to prod only on main)'
      }
    }
    stage('Monitoring & Alerts') {
      steps {
        echo 'Monitoring: (hook Datadog/New Relic alerts next)'
      }
    }
  }
  post {
    always {
      echo 'Pipeline finished (post actions go here later: archiving, junit, etc.)'
    }
  }
}
