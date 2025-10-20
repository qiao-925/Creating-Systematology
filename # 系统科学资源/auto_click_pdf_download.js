// 自动点击PDF下载按钮脚本 - 在知网文章详情页按F12打开控制台，粘贴此代码并回车
// 结合Tampermonkey使用，用户匹配：http://sq.zjhzlib.cn/https/vpn/2/NNYHGLUDN3WXTLUPMW4A/kcms2/article/abstract*

(function() {
    console.log('=== 自动点击PDF下载 ===');
    console.log('等待页面加载...');
    
    // 等待页面加载完成
    if (document.readyState === 'complete') {
        延迟点击下载();
    } else {
        window.addEventListener('load', 延迟点击下载);
    }
    
    function 延迟点击下载() {
        console.log('页面已加载，2秒后自动点击PDF下载按钮...');
        
        setTimeout(() => {
            // 查找PDF下载按钮
            const PDF下载按钮 = document.querySelector('#pdfDown') || 
                              document.querySelector('a[name="pdfDown"]') ||
                              document.querySelector('a[href*="download"]');
            
            if (PDF下载按钮) {
                const 文章标题 = document.querySelector('h1')?.textContent.trim() || '未知文章';
                
                console.log(`✓ 找到PDF下载按钮`);
                console.log(`📄 文章：${文章标题}`);
                console.log(`🖱️ 点击下载...`);
                
                // 点击下载按钮
                PDF下载按钮.click();
                
                console.log('✅ PDF下载已触发！');
                
                // 可选：3秒后自动关闭当前标签页
                // setTimeout(() => {
                //     console.log('3秒后自动关闭当前页面...');
                //     window.close();
                // }, 3000);
                
            } else {
                console.error('❌ 未找到PDF下载按钮');
                alert('❌ 未找到PDF下载按钮！\n请检查页面是否为文章详情页。');
            }
            
        }, 2000); // 等待2秒
    }
    
})();

