// PWA Install Prompt Handler
// LP画面でアプリインストール導線を提供

(function() {
  'use strict';
  
  let deferredPrompt;
  const installButton = document.getElementById('pwa-install-btn');
  const iosInstructions = document.getElementById('ios-install-instructions');
  
  // iOS判定
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }
  
  // Standalone判定（既にインストール済み）
  function isInStandaloneMode() {
    return (window.matchMedia('(display-mode: standalone)').matches) || 
           (window.navigator.standalone === true);
  }
  
  // beforeinstallprompt イベント（Chrome/Android）
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] beforeinstallprompt fired');
    
    // デフォルトのプロンプトを抑制
    e.preventDefault();
    
    // 後で使うために保存
    deferredPrompt = e;
    
    // インストールボタンを表示
    if (installButton) {
      installButton.style.display = 'block';
    }
  });
  
  // インストールボタンクリック
  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) {
        console.log('[PWA] deferredPrompt not available');
        return;
      }
      
      // プロンプトを表示
      deferredPrompt.prompt();
      
      // ユーザーの選択を待つ
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] User choice: ${outcome}`);
      
      if (outcome === 'accepted') {
        // 成功トースト表示
        showToast('アプリをインストールしました！', 'success');
      }
      
      // プロンプトは一度しか使えない
      deferredPrompt = null;
      installButton.style.display = 'none';
    });
  }
  
  // iOS用の説明を表示
  if (isIOS() && !isInStandaloneMode()) {
    if (iosInstructions) {
      iosInstructions.style.display = 'block';
    }
  }
  
  // インストール成功イベント
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    showToast('インストール完了！ホーム画面から起動できます。', 'success');
    
    if (installButton) {
      installButton.style.display = 'none';
    }
  });
  
  // 簡易トースト表示関数
  function showToast(message, type = 'info') {
    // Bootstrapのtoastがあれば使う、なければalert
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
      const toastHTML = `
        <div class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
          <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
          </div>
        </div>
      `;
      
      const toastContainer = document.querySelector('.toast-container') || createToastContainer();
      toastContainer.insertAdjacentHTML('beforeend', toastHTML);
      
      const toastElement = toastContainer.lastElementChild;
      const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
      toast.show();
      
      // 表示後に削除
      toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
      });
    } else {
      // フォールバック
      alert(message);
    }
  }
  
  function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(container);
    return container;
  }
  
})();
