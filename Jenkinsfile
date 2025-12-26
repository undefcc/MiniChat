pipeline {
    agent any
    
    environment {
        // 阿里云镜像仓库配置
        REGISTRY = 'crpi-zpvonb2nha7j0qgy.cn-shenzhen.personal.cr.aliyuncs.com'
        NAMESPACE = 'cc4ever'
        
        // 镜像名称
        WEB_IMAGE = "${REGISTRY}/${NAMESPACE}/minichat-web:latest"
        SIGNALING_IMAGE = "${REGISTRY}/${NAMESPACE}/minichat-signaling:latest"
        GATEWAY_IMAGE = "${REGISTRY}/${NAMESPACE}/minichat-gateway:latest"
        
        // Docker Compose 文件
        COMPOSE_FILE = 'docker-compose.yml'
        
        // 项目目录
        PROJECT_DIR = '/opt/minichat'
    }
    
    stages {
        stage('准备环境') {
            steps {
                script {
                    echo '检查 Docker 和 Docker Compose...'
                    sh 'docker --version'
                    sh 'docker-compose --version'
                }
            }
        }
        
        stage('登录阿里云镜像仓库') {
            steps {
                script {
                    echo '登录阿里云容器镜像服务...'
                    withCredentials([usernamePassword(
                        credentialsId: 'aliyun-docker-registry',
                        usernameVariable: 'DOCKER_USERNAME',
                        passwordVariable: 'DOCKER_PASSWORD'
                    )]) {
                        sh """
                            echo \$DOCKER_PASSWORD | docker login ${REGISTRY} \\
                                --username \$DOCKER_USERNAME \\
                                --password-stdin
                        """
                    }
                }
            }
        }
        
        stage('拉取最新镜像') {
            steps {
                script {
                    echo '拉取最新的 Docker 镜像...'
                    sh "docker pull ${WEB_IMAGE}"
                    sh "docker pull ${SIGNALING_IMAGE}"
                    sh "docker pull ${GATEWAY_IMAGE}"
                }
            }
        }
        
        stage('拉取代码') {
            steps {
                script {
                    echo '从 GitHub 拉取最新代码...'
                    sh """
                        if [ -d ${PROJECT_DIR}/.git ]; then
                            cd ${PROJECT_DIR}
                            git pull origin master
                        else
                            rm -rf ${PROJECT_DIR}
                            git clone https://github.com/undefcc/MiniChat.git ${PROJECT_DIR}
                        fi
                    """
                }
            }
        }
        
        stage('准备环境变量') {
            steps {
                script {
                    echo '创建 .env 配置文件...'
                    withCredentials([
                        string(credentialsId: 'minichat-cors-origin', variable: 'CORS_ORIGIN'),
                        string(credentialsId: 'minichat-socket-url', variable: 'SOCKET_URL'),
                        string(credentialsId: 'minichat-turn-username', variable: 'TURN_USER'),
                        string(credentialsId: 'minichat-turn-credential', variable: 'TURN_CRED'),
                        string(credentialsId: 'minichat-jwt-secret', variable: 'JWT_SEC')
                    ]) {
                        sh """
                            cat > ${PROJECT_DIR}/.env << EOF
CORS_ORIGIN=${CORS_ORIGIN}
NEXT_PUBLIC_SOCKET_URL=${SOCKET_URL}
TURN_USERNAME=${TURN_USER}
TURN_CREDENTIAL=${TURN_CRED}
JWT_SECRET=${JWT_SEC}
EOF
                        """
                    }
                }
            }
        }
        
        stage('停止旧容器') {
            steps {
                script {
                    echo '停止并移除旧的容器...'
                    sh """
                        cd ${PROJECT_DIR}
                        docker-compose down || true
                    """
                }
            }
        }
        
        stage('启动服务') {
            steps {
                script {
                    echo '启动所有服务...'
                    sh """
                        cd ${PROJECT_DIR}
                        docker-compose up -d
                    """
                }
            }
        }
        
        stage('健康检查') {
            steps {
                script {
                    echo '等待服务启动...'
                    sleep(time: 10, unit: 'SECONDS')
                    
                    echo '检查服务状态...'
                    sh """
                        cd ${PROJECT_DIR}
                        docker-compose ps
                    """
                    
                    echo '检查日志...'
                    sh """
                        cd ${PROJECT_DIR}
                        docker-compose logs --tail=20
                    """
                }
            }
        }
        
        stage('清理旧镜像') {
            steps {
                script {
                    echo '清理未使用的 Docker 镜像...'
                    sh 'docker image prune -af --filter "until=24h" || true'
                }
            }
        }
    }
    
    post {
        success {
            echo '✅ 部署成功！'
            echo "Web 服务: http://YOUR_SERVER:3100"
            echo "Signaling 服务: http://YOUR_SERVER:3101"
            echo "Gateway 服务: http://YOUR_SERVER:4000"
        }
        
        failure {
            echo '❌ 部署失败！请检查日志。'
            sh """
                cd ${PROJECT_DIR}
                docker-compose logs --tail=50
            """ 
        }
        
        always {
            echo '登出 Docker Registry...'
            sh 'docker logout ${REGISTRY} || true'
        }
    }
}
