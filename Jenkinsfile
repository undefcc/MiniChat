// Jenkinsfile: 拉取阿里云镜像并部署 MiniChat（简化版：仅 signaling + web）
// 查看容器环境变量: docker exec minichat-web env
// 查看容器日志: docker logs minichat-web
pipeline {
    agent any
    environment {
        REGISTRY = 'crpi-zpvonb2nha7j0qgy.cn-shenzhen.personal.cr.aliyuncs.com'
        IMAGE_NAMESPACE = 'cc4ever'
        ECS_HOST = '47.115.57.172' // 替换为实际 ECS 公网IP
        ECS_USER = 'root' // 或 ubuntu/ecs-user
    }
    stages {
        stage('Prepare Deployment') {
            steps {
                script {
                    echo "准备部署 MiniChat 到 ECS..."
                    echo "Registry: ${REGISTRY}"
                    echo "ECS Host: ${ECS_HOST}"
                }
            }
        }
        stage('Deploy to ECS') {
            steps {
                withCredentials([
                    usernamePassword(credentialsId: 'aliyun-docker', usernameVariable: 'ALIYUN_DOCKER_USERNAME', passwordVariable: 'ALIYUN_DOCKER_PASSWORD'),
                    sshUserPrivateKey(credentialsId: 'ecs-server-key', keyFileVariable: 'SSH_KEY'),
                    string(credentialsId: 'minichat-turn-username', variable: 'TURN_USERNAME'),
                    string(credentialsId: 'minichat-turn-credential', variable: 'TURN_CREDENTIAL'),
                    string(credentialsId: 'minichat-cors-origin', variable: 'CORS_ORIGIN'),
                    string(credentialsId: 'minichat-socket-url', variable: 'SOCKET_URL')
                ]) {
                    sh '''
                    # 部署应用
                    ssh -i $SSH_KEY -o StrictHostKeyChecking=no $ECS_USER@$ECS_HOST bash << EOF
                        # 设置环境变量
                        export REGISTRY="$REGISTRY"
                        export IMAGE_NAMESPACE="$IMAGE_NAMESPACE"
                        
                        # 登录到阿里云 Docker Registry
                        echo "登录到 Docker Registry..."
                        docker login --username=$ALIYUN_DOCKER_USERNAME --password=$ALIYUN_DOCKER_PASSWORD \$REGISTRY
                        
                        # 清理旧镜像缓存，强制拉取最新
                        echo "清理旧镜像..."
                        docker rmi \$REGISTRY/\$IMAGE_NAMESPACE/minichat-web:latest 2>/dev/null || true
                        
                        # 拉取最新镜像
                        echo "拉取最新镜像..."
                        docker pull \$REGISTRY/\$IMAGE_NAMESPACE/minichat-web:latest
                        
                        # 创建网络（如果不存在）
                        echo "创建 Docker 网络..."
                        docker network create minichat-network || echo "网络已存在"
                        
                        # 停止并删除旧容器
                        echo "停止旧容器..."
                        docker stop minichat-web 2>/dev/null || true
                        docker rm minichat-web 2>/dev/null || true
                        # docker stop minichat-signaling 2>/dev/null || true
                        # docker rm minichat-signaling 2>/dev/null || true
                        
                        # 验证镜像
                        echo "验证镜像..."
                        docker images | grep minichat-web
                        
                        # # 启动 Signaling（镜像不存在，暂时注释）
                        # echo "启动 Signaling..."
                        # docker run -d \\
                        #   --name minichat-signaling \\
                        #   --network minichat-network \\
                        #   -e NODE_ENV=production \\
                        #   -e PORT=3101 \\
                        #   -e CORS_ORIGIN=$CORS_ORIGIN \\
                        #   -p 3101:3101 \\
                        #   --restart unless-stopped \\
                        #   \$REGISTRY/\$IMAGE_NAMESPACE/minichat-signaling:latest
                        
                        # 启动 Web（使用 next start）
                        echo "启动 Web..."
                        docker run -d \\
                          --name minichat-web \\
                          --network minichat-network \\
                          -e NODE_ENV=production \\
                          -e PORT=3100 \\
                          -e HOSTNAME=0.0.0.0 \\
                          -e NEXT_PUBLIC_SOCKET_URL=$SOCKET_URL \\
                          -e NEXT_PUBLIC_TURN_USERNAME=$TURN_USERNAME \\
                          -e NEXT_PUBLIC_TURN_CREDENTIAL=$TURN_CREDENTIAL \\
                          -p 3100:3100 \\
                          --restart unless-stopped \\
                          \$REGISTRY/\$IMAGE_NAMESPACE/minichat-web:latest
                        
                        # 检查服务状态
                        echo "检查服务状态..."
                        sleep 5
                        docker ps --filter "name=minichat-"
                        
                        echo "部署完成！"
EOF
                    '''
                }
            }
        }
        stage('Health Check') {
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'ecs-server-key', keyFileVariable: 'SSH_KEY')
                ]) {
                    sh '''
                    ssh -i $SSH_KEY -o StrictHostKeyChecking=no $ECS_USER@$ECS_HOST << EOF
                        echo "检查容器健康状态..."
                        docker ps --filter "name=minichat-" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
                        
                        # echo ""
                        # echo "检查 signaling 服务..."
                        # docker logs --tail 20 minichat-signaling || echo "signaling 日志获取失败"
                        
                        echo ""
                        echo "检查 web 服务..."
                        docker logs --tail 20 minichat-web || echo "web 日志获取失败"
EOF
                    '''
                }
            }
        }
    }
    post {
        success {
            echo '✅ MiniChat 部署成功！'
            echo '访问地址: http://47.115.57.172:3100'
            // echo '信令服务: ws://47.115.57.172:3101'
        }
        failure {
            echo '❌ 部署失败！'
            withCredentials([
                sshUserPrivateKey(credentialsId: 'ecs-server-key', keyFileVariable: 'SSH_KEY')
            ]) {
                sh '''
                ssh -i $SSH_KEY -o StrictHostKeyChecking=no $ECS_USER@$ECS_HOST << EOF
                    echo "显示错误日志..."
                    echo "所有 minichat 容器状态:"
                    docker ps -a --filter "name=minichat-" || echo "未找到 minichat 相关容器"
                    
                    echo ""
                    echo "查看容器日志:"
                    for container in minichat-web; do
                        if docker ps -a --format "{{.Names}}" | grep -q "^\$container\$"; then
                            echo "=== \$container 日志 ==="
                            docker logs --tail 30 \$container 2>&1 || echo "无法获取日志"
                        fi
                    done
                    # for container in minichat-signaling; do
                    #     if docker ps -a --format "{{.Names}}" | grep -q "^\$container\$"; then
                    #         echo "=== \$container 日志 ==="
                    #         docker logs --tail 30 \$container 2>&1 || echo "无法获取日志"
                    #     fi
                    # done
EOF
                '''
            }
        }
    }
}
