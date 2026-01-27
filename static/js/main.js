/**
 * PhotoShare - メインJavaScript
 */

// DOMロード後に実行
document.addEventListener('DOMContentLoaded', function() {
    console.log('PhotoShare initialized');

    // フラッシュメッセージの自動非表示
    autoHideAlerts();

    // 画像プレビュー機能（将来の投稿フォーム用）
    initImagePreview();
});

/**
 * フラッシュメッセージを5秒後に自動的に非表示
 */
function autoHideAlerts() {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
}

/**
 * 画像プレビュー機能の初期化
 */
function initImagePreview() {
    const imageInputs = document.querySelectorAll('input[type="file"][accept*="image"]');
    imageInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('image-preview');
                    if (preview) {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    });
}

/**
 * いいね機能（Ajax）
 */
function toggleLike(postId) {
    fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // いいね数の更新
            const likeCount = document.querySelector(`#like-count-${postId}`);
            if (likeCount) {
                likeCount.textContent = data.like_count;
            }
            
            // ハートアイコンの切り替え
            const heartIcon = document.querySelector(`#heart-icon-${postId}`);
            if (heartIcon) {
                if (data.liked) {
                    heartIcon.classList.remove('far');
                    heartIcon.classList.add('fas', 'text-danger');
                } else {
                    heartIcon.classList.remove('fas', 'text-danger');
                    heartIcon.classList.add('far');
                }
            }
        }
    })
    .catch(error => console.error('Error:', error));
}

/**
 * CSRFトークンの取得
 */
function getCSRFToken() {
    const token = document.querySelector('meta[name="csrf-token"]');
    return token ? token.getAttribute('content') : '';
}

/**
 * 画像の遅延読み込み
 */
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img.lazy').forEach(img => {
        imageObserver.observe(img);
    });
}
