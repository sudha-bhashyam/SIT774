pipeline {
  agent any
  options { skipDefaultCheckout(true); timestamps() }

  environment {
    PATH = "/opt/homebrew/opt/node@18/bin:/opt/homebrew/bin:/usr/local/bin:${env.PATH}"
    APP_PORT = '3000'
    // Pull version from package.json (fallback to 0.0.0 if missing)
    APP_VERSION = sh(script: "node -p \"try{require('./package.json').version}catch(e){'0.0.0'}\"", returnStdout: true).trim()
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

          # Optional project build step (if present)
          if npm run | grep -qE '^\\s*build\\s'; then
            npm run build
          else
            echo "No build script"
          fi

          # Create a versioned artefact tarball
          mkdir -p dist
          rm -rf .pack && mkdir .pack
          rsync -a --exclude ".git" --exclude "dist" --exclude "node_modules" . .pack/
          SHORT_COMMIT=$(git rev-parse --short HEAD || echo local)
          VERSION_TAG="${APP_VERSION}-${SHORT_COMMIT}"
          TAR="dist/sit774-nodeapp-${VERSION_TAG}.tar.gz"
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

          # Run unit tests with coverage
          npx jest --ci --reporters=default --reporters=jest-junit --coverage --coverageReporters=json-summary,text-summary

          # Gate on coverage >= 80% (statements)
          node -e "const fs=require('fs'); \
            const c=JSON.parse(fs.readFileSync('coverage/coverage-summary.json','utf8')).total; \
            const pct=c.statements.pct; \
            console.log('Statements coverage:', pct+'%'); \
            if(pct<80){console.error('Coverage below 80%'); process.exit(1)}"
        '''
      }
      post {
        always {
          junit 'reports/junit.xml'   // only real test results here
          archiveArtifacts artifacts: 'coverage/**', fingerprint: true, allowEmptyArchive: true
        }
      }
    }

    stage('Code Quality') {
      steps {
        sh '''
          set -eux
          mkdir -p reports

          # ESLint to JSON
          npx eslint . --ext .js -f json -o reports/eslint.json || true
          # (Optional) also emit JUnit for human viewing; do NOT publish with junit()
          npx eslint . --ext .js --format junit -o reports/eslint-junit.xml || true

          # jscpd duplication (JSON)
          npx jscpd --pattern "**/*.js" \
            --ignore "**/node_modules/**,**/dist/**,**/.pack/**,**/reports/**" \
            --reporters json --output reports/jscpd || true

          # Gate: ESLint errors == 0, warnings <= 20; jscpd duplication <= 2.0%
          node -e " \
            const fs=require('fs'); \
            const es=JSON.parse(fs.readFileSync('reports/eslint.json','utf8')); \
            const results=Array.isArray(es)?es:[]; \
            const errs=results.reduce((a,r)=>a+r.errorCount,0); \
            const warns=results.reduce((a,r)=>a+r.warningCount,0); \
            console.log('ESLint errors:',errs,'warnings:',warns); \
            let dupPct=0; \
            try{ \
              const j=JSON.parse(fs.readFileSync('reports/jscpd/jscpd-report.json','utf8')); \
              dupPct=(j?.statistics?.percentage)||0; \
            }catch(e){console.log('No jscpd JSON found; assuming 0%');} \
            console.log('Duplication %:', dupPct); \
            if (errs>0 || warns>20 || dupPct>2) { \
              console.error('Quality gate failed: ESLint errors>0 or warnings>20 or duplication>2%'); \
              process.exit(1); \
            }"
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/eslint.json,reports/eslint-junit.xml,reports/jscpd/**', fingerprint: true, allowEmptyArchive: true
        }
      }
    }

    stage('Security') {
      steps {
        sh '''
          set -eux
          mkdir -p reports

          # Dependency scans
          npm audit --omit=dev --json > reports/npm-audit.json || true
          npx retire --path . --outputformat json --outputpath reports/retire.json || true

          # Summarize & gate on High/Critical
          node -e " \
            const fs=require('fs'); \
            const out=[]; let high=0, critical=0; \
            try{ \
              const a=JSON.parse(fs.readFileSync('reports/npm-audit.json','utf8')); \
              const v=a?.vulnerabilities||a?.metadata?.vulnerabilities||{}; \
              high+=v.high||0; critical+=v.critical||0; \
              out.push('# npm audit summary'); \
              out.push('High: '+(v.high||0)+', Critical: '+(v.critical||0)); \
            }catch(e){ out.push('# npm audit summary\\n(no data)'); } \
            try{ \
              const r=JSON.parse(fs.readFileSync('reports/retire.json','utf8')); \
              const res=(r?.data||[]).flatMap(d=>d.results||[]); \
              const sevMap={'medium':0,'high':0,'critical':0}; \
              res.forEach(x=>{(x.vulnerabilities||[]).forEach(v=>{ \
                const s=(v.severity||'').toLowerCase(); \
                if(sevMap[s]!==undefined) sevMap[s]++; \
              })}); \
              high+=sevMap.high; critical+=sevMap.critical; \
              out.push('\\n# retire.js summary'); \
              out.push('High: '+sevMap.high+', Critical: '+sevMap.critical); \
            }catch(e){ out.push('\\n# retire.js summary\\n(no data)'); } \
            out.push('\\n## Action'); \
            if(high+critical===0){ \
              out.push('No High/Critical found.'); \
            } else { \
              out.push('Review & upgrade vulnerable packages. Document false positives if any.'); \
            } \
            fs.writeFileSync('reports/security-summary.md', out.join('\\n')); \
            if(high+critical>0){ \
              console.error('High/Critical vulnerabilities found:', high+critical); \
              process.exit(1); \
            }"
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'reports/npm-audit.json,reports/retire.json,reports/security-summary.md', fingerprint: true
        }
      }
    }

    stage('Deploy (Staging)') {
      steps {
        sh '''
          set -eux

          # Verify Docker is reachable (nice error if not)
          if ! docker version >/dev/null 2>&1; then
            echo "ERROR: Docker daemon is not reachable. Start Docker Desktop or Colima."
            exit 2
          fi

          export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1

          # Build via compose (keeps your existing behavior)
          docker compose down -v || true
          docker compose up -d --build

          # Tag the compose-built image with a versioned tag (in addition to :latest)
          SHORT_COMMIT=$(git rev-parse --short HEAD || echo local)
          VERSION_TAG="${APP_VERSION}-${SHORT_COMMIT}"
          docker tag sit774_ci-cd-web:latest sit774_ci-cd-web:${VERSION_TAG} || true

          # Health wait loop
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
          archiveArtifacts artifacts: 'dist/*.tar.gz,reports/staging-logs.txt', fingerprint: true, allowEmptyArchive: true
          sh 'docker compose ps || true'
        }
      }
    }

    /* ======= LEAVE THESE STAGES AS-IS PER YOUR REQUEST ======= */

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
