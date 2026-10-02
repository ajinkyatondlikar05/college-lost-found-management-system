pipeline {
    agent any

    environment {
        CI = 'true'
        NODE_ENV = 'test'
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code from GitHub repository...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing backend and frontend dependencies...'
                script {
                    if (isUnix()) {
                        sh 'npm --prefix backend ci'
                        sh 'npm --prefix frontend ci'
                    } else {
                        bat 'npm --prefix backend ci'
                        bat 'npm --prefix frontend ci'
                    }
                }
            }
        }

        stage('Test') {
            steps {
                echo 'Running full automated test suite (isolated in-memory validation & mocked services)...'
                script {
                    if (isUnix()) {
                        sh 'npm test'
                    } else {
                        bat 'npm test'
                    }
                }
            }
        }

        stage('Build') {
            steps {
                echo 'Building production frontend assets...'
                script {
                    if (isUnix()) {
                        sh 'npm --prefix frontend run build'
                    } else {
                        bat 'npm --prefix frontend run build'
                    }
                }
            }
        }

        stage('Archive Artifacts') {
            steps {
                echo 'Archiving production build distribution...'
                archiveArtifacts artifacts: 'frontend/dist/**', allowEmptyArchive: false, fingerprint: true
            }
        }
    }

    post {
        success {
            echo '================================================================='
            echo '  CI PIPELINE SUCCESS: All automated tests passed and build verified!'
            echo '================================================================='
        }
        failure {
            echo '================================================================='
            echo '  CI PIPELINE FAILED: Review the stage output above for errors.'
            echo '================================================================='
        }
    }
}
