#!/bin/bash

# 达芬奇密码游戏部署脚本
# 使用方法: ./scripts/deploy.sh [dev|prod|docker]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# 检查依赖
check_dependencies() {
    print_message "检查系统依赖..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装，请先安装 Node.js 18+"
        exit 1
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装，请先安装 npm"
        exit 1
    fi
    
    # 检查Node.js版本
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js 版本过低，需要 18+ 版本"
        exit 1
    fi
    
    print_message "✅ 系统依赖检查通过"
}

# 安装项目依赖
install_dependencies() {
    print_message "安装项目依赖..."
    npm install
    print_message "✅ 依赖安装完成"
}

# 开发环境部署
deploy_dev() {
    print_header "开发环境部署"
    
    check_dependencies
    install_dependencies
    
    print_message "启动开发服务器..."
    print_message "访问地址: http://localhost:3000"
    print_message "按 Ctrl+C 停止服务器"
    
    npm run dev
}

# 生产环境部署
deploy_prod() {
    print_header "生产环境部署"
    
    check_dependencies
    install_dependencies
    
    print_message "构建生产版本..."
    npm run build
    
    print_message "启动生产服务器..."
    print_message "访问地址: http://localhost:3000"
    print_message "按 Ctrl+C 停止服务器"
    
    npm start
}

# Docker部署
deploy_docker() {
    print_header "Docker 部署"
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    print_message "启动 Docker 服务..."
    docker-compose up -d
    
    print_message "等待服务启动..."
    sleep 10
    
    print_message "✅ Docker 部署完成！"
    print_message "🌐 应用地址: http://localhost:3000"
    print_message "🗄️ 数据库管理: http://localhost:8080"
    print_message "🔴 Redis管理: http://localhost:8081"
    
    print_message "查看服务状态: docker-compose ps"
    print_message "查看日志: docker-compose logs -f"
    print_message "停止服务: docker-compose down"
}

# 数据库初始化
init_database() {
    print_header "数据库初始化"
    
    print_message "运行数据库初始化脚本..."
    npm run db:setup
    
    if [ $? -eq 0 ]; then
        print_message "✅ 数据库初始化成功"
    else
        print_error "❌ 数据库初始化失败"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    echo "达芬奇密码游戏部署脚本"
    echo ""
    echo "使用方法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  dev     启动开发环境"
    echo "  prod    启动生产环境"
    echo "  docker  使用Docker部署"
    echo "  db      初始化数据库"
    echo "  help    显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 dev      # 启动开发环境"
    echo "  $0 prod     # 启动生产环境"
    echo "  $0 docker   # Docker部署"
    echo "  $0 db       # 初始化数据库"
}

# 主函数
main() {
    case "${1:-dev}" in
        "dev")
            deploy_dev
            ;;
        "prod")
            deploy_prod
            ;;
        "docker")
            deploy_docker
            ;;
        "db")
            init_database
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"

