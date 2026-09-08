#!/bin/bash

echo "🚀 Starting EMART Application..."
echo ""

# Check if backend is running
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Backend already running on port 5000"
else
    echo "🔄 Starting Backend..."
    echo "   Run: cd Backend && npm run dev"
fi

# Check if frontend is running
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Frontend already running on port 5173"
else
    echo "🔄 Starting Frontend..."
    echo "   Run: cd Frontend && npm run dev"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 EMART Application Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Frontend:  http://localhost:5173"
echo "🔌 Backend:   http://localhost:5000"
echo "🏥 Health:    http://localhost:5000/api/v1/health"
echo ""
echo "📝 To test authentication:"
echo "   1. Open http://localhost:5173/login"
echo "   2. Login with your credentials"
echo "   3. Check navbar for your user info ✅"
echo ""
echo "🐛 Debug: Open browser console (F12) for [Auth] logs"
echo ""
echo "📚 Docs: See AUTHENTICATION_FINAL_STATUS.md"
echo ""
