import { player, participants } from './state.js';
import { playSound } from './audio.js';
import { showModal, hideModal } from './ui.js';
import { currentLanguage } from './translation.js';

// Use WebsimSocket for real-time sync
const room = new WebsimSocket();

let communityInterval;
let activePostId = null;
let reportingPostId = null;

// --- DOM Elements ---
const communityScreen = document.getElementById('community-screen');
const createPostBtn = document.getElementById('community-create-post-btn');
const createPostModal = document.getElementById('create-post-modal');
const closePostModalBtn = document.getElementById('close-create-post-btn');
const postSubmitBtn = document.getElementById('post-submit-btn');
const postTitleInput = document.getElementById('post-title-input');
const postContentInput = document.getElementById('post-content-editable');
const attachImageBtn = document.getElementById('attach-image-btn');
const imageFileInput = document.getElementById('image-file-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imageUploadLoader = document.getElementById('image-upload-loader');

const postDetailModal = document.getElementById('post-detail-modal');
const closePostDetailBtn = document.getElementById('close-post-detail-btn');

const notificationsModal = document.getElementById('notifications-modal');
const closeNotificationsBtn = document.getElementById('close-notifications-btn');
const notificationsBtn = document.getElementById('community-notifications-btn');

const reportModal = document.getElementById('report-modal');
const closeReportModalBtn = document.getElementById('close-report-modal-btn');
const submitReportBtn = document.getElementById('submit-report-btn');

const reportsViewerModal = document.getElementById('reports-viewer-modal');
const closeReportsViewerBtn = document.getElementById('close-reports-viewer-btn');

const searchInput = document.getElementById('community-search-input');
const searchBtn = document.getElementById('community-search-btn');

// --- CORE FUNCTIONS ---

export function initCommunity() {
    setupEventListeners();
    
    // Subscribe to real-time updates
    room.collection('post').subscribe(() => renderFeed());
    room.collection('like').subscribe(() => {
        if (activePostId) updatePostDetailView(activePostId);
    });
    room.collection('comment').subscribe(() => {
        if (activePostId) updatePostDetailView(activePostId);
    });
    room.collection('follow').subscribe(updateFollowButtons);
    room.collection('report').subscribe(updateReportsBadge);
}

export async function showCommunityScreen() {
    await renderFeed();
    await updateReportsBadge();
    
    // Start bot community activity
    if (communityInterval) clearInterval(communityInterval);
    communityInterval = setInterval(runCommunitySimulation, 20000);
}

export function hideCommunityScreen() {
    if (communityInterval) clearInterval(communityInterval);
}

async function renderFeed(filteredPosts = null) {
    const feedContainer = document.getElementById('community-feed');
    feedContainer.innerHTML = '';
    
    let posts = room.collection('post').getList();
    
    // The subscribe callback passes the list, let's use it if available
    const postsToRender = filteredPosts || posts;

    if (postsToRender.length === 0) {
        feedContainer.innerHTML = `<div class="no-posts-message">The community is quiet... Be the first to post!</div>`;
        return;
    }

    const postElements = await Promise.all(postsToRender.map(post => createPostElement(post)));
    postElements.forEach(postElement => {
        if(postElement) {
            feedContainer.appendChild(postElement);
        }
    });
}

// --- EVENT LISTENERS ---

function setupEventListeners() {
    // Post Creation
    createPostBtn.addEventListener('click', showCreatePostModal);
    closePostModalBtn.addEventListener('click', hideCreatePostModal);
    createPostModal.addEventListener('click', (e) => {
        if (e.target === createPostModal) hideCreatePostModal();
    });
    postSubmitBtn.addEventListener('click', handlePostSubmit);
    attachImageBtn.addEventListener('click', () => imageFileInput.click());
    imageFileInput.addEventListener('change', handleImageUpload);

    // Rich Text Editor
    setupRichTextEditor();

    // Post Interactions
    document.getElementById('community-feed').addEventListener('click', handleFeedClick);

    // Post Detail Modal
    closePostDetailBtn.addEventListener('click', hidePostDetailModal);
    postDetailModal.addEventListener('click', (e) => {
        if (e.target === postDetailModal) hidePostDetailModal();
    });
    document.getElementById('add-comment-btn').addEventListener('click', handleAddComment);
    document.getElementById('post-detail-content').addEventListener('click', handlePostDetailInteraction);

    // Report Modal
    closeReportModalBtn.addEventListener('click', () => hideModal(reportModal));
    reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal) hideModal(reportModal);
    });
    submitReportBtn.addEventListener('click', handleSubmitReport);

    // Reports Viewer - Click on bell icon
    notificationsBtn.addEventListener('click', async (e) => {
        const currentUser = await window.websim.getCurrentUser();
        const creator = await window.websim.getCreatedBy();
        
        if (currentUser.username === creator.username) {
            // Show reports for creator
            showReportsViewer();
        } else {
            // Show notifications for regular users
            showNotifications();
        }
    });
    
    closeReportsViewerBtn.addEventListener('click', () => hideModal(reportsViewerModal));
    reportsViewerModal.addEventListener('click', (e) => {
        if (e.target === reportsViewerModal) hideModal(reportsViewerModal);
    });

    closeNotificationsBtn.addEventListener('click', () => hideModal(notificationsModal));
    notificationsModal.addEventListener('click', (e) => {
        if (e.target === notificationsModal) hideModal(notificationsModal);
    });

    // Search
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
}

function setupRichTextEditor() {
    document.getElementById('editor-font-select').addEventListener('change', (e) => {
        document.execCommand('fontName', false, e.target.value);
    });
    document.getElementById('editor-size-select').addEventListener('change', (e) => {
        document.execCommand('fontSize', false, e.target.value);
    });
    document.getElementById('editor-bold-btn').addEventListener('click', () => document.execCommand('bold'));
    document.getElementById('editor-italic-btn').addEventListener('click', () => document.execCommand('italic'));
    document.getElementById('editor-underline-btn').addEventListener('click', () => document.execCommand('underline'));
    document.getElementById('editor-strike-btn').addEventListener('click', () => document.execCommand('strikeThrough'));
    document.getElementById('editor-color-btn').addEventListener('input', (e) => document.execCommand('foreColor', false, e.target.value));
    document.getElementById('editor-bg-btn').addEventListener('input', (e) => document.execCommand('backColor', false, e.target.value));
    document.getElementById('editor-link-btn').addEventListener('click', () => {
        const url = prompt('Enter URL:');
        if (url) document.execCommand('createLink', false, url);
    });
    document.getElementById('editor-align-left-btn').addEventListener('click', () => document.execCommand('justifyLeft'));
    document.getElementById('editor-align-center-btn').addEventListener('click', () => document.execCommand('justifyCenter'));
    document.getElementById('editor-align-right-btn').addEventListener('click', () => document.execCommand('justifyRight'));
    document.getElementById('editor-list-btn').addEventListener('click', () => document.execCommand('insertUnorderedList'));
}

// --- POST CREATION LOGIC ---

function showCreatePostModal() {
    playSound('click');
    resetCreatePostModal();
    showModal(createPostModal);
}

function hideCreatePostModal() {
    hideModal(createPostModal);
}

function resetCreatePostModal() {
    postTitleInput.value = '';
    postContentInput.innerHTML = '';
    imagePreviewContainer.innerHTML = '';
    imagePreviewContainer.style.display = 'none';
    postContentInput.dataset.imageUrl = '';
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
        alert('Image too large. Maximum size is 5MB.');
        return;
    }

    imageUploadLoader.style.display = 'block';
    attachImageBtn.disabled = true;

    try {
        const url = await websim.upload(file);
        imagePreviewContainer.innerHTML = `<img src="${url}" alt="Uploaded image"><button class="remove-image-btn">&times;</button>`;
        imagePreviewContainer.style.display = 'block';
        postContentInput.dataset.imageUrl = url;

        imagePreviewContainer.querySelector('.remove-image-btn').addEventListener('click', () => {
            postContentInput.dataset.imageUrl = '';
            imagePreviewContainer.innerHTML = '';
            imagePreviewContainer.style.display = 'none';
            imageFileInput.value = '';
        });
    } catch (error) {
        console.error('Upload failed:', error);
        alert('Image upload failed. Please try again.');
    } finally {
        imageUploadLoader.style.display = 'none';
        attachImageBtn.disabled = false;
    }
}

async function handlePostSubmit() {
    const title = postTitleInput.value.trim();
    const content = postContentInput.innerHTML;
    const imageUrl = postContentInput.dataset.imageUrl || null;

    if (!title || postContentInput.innerText.trim() === '') {
        alert("Post must have a title and content.");
        return;
    }

    const currentUser = await window.websim.getCurrentUser();

    await room.collection('post').create({
        author: currentUser.username,
        title,
        content,
        image: imageUrl,
        timestamp: Date.now()
    });

    hideCreatePostModal();
    playSound('click');
}

// --- POST INTERACTION LOGIC ---

function handleFeedClick(e) {
    const target = e.target;
    const postCard = target.closest('.post-card');
    if (!postCard) return;
    const postId = postCard.dataset.postId;

    if (target.classList.contains('like-btn') || target.closest('.like-btn')) {
        handleLike(postId);
    } else if (target.classList.contains('follow-btn') || target.closest('.follow-btn')) {
        const author = postCard.dataset.author;
        handleFollow(author);
    } else if (target.classList.contains('post-options-btn') || target.closest('.post-options-btn')) {
        togglePostOptionsMenu(postId);
    } else if (target.classList.contains('report-post-btn')) {
        startReportPost(postId);
    } else if (target.classList.contains('translate-post-btn')) {
        translatePost(postId);
    } else {
        showPostDetailView(postId);
    }
}

async function handleLike(postId) {
    const currentUser = await window.websim.getCurrentUser();
    const existingLikes = room.collection('like').filter({ post_id: postId }).getList();
    const myLike = existingLikes.find(l => l.username === currentUser.username);

    if (myLike) {
        await room.collection('like').delete(myLike.id);
    } else {
        await room.collection('like').create({ post_id: postId });
    }

    playSound('click');
}

async function handleFollow(authorToFollow) {
    const currentUser = await window.websim.getCurrentUser();
    if (authorToFollow === currentUser.username) return;

    const existingFollows = room.collection('follow').filter({ following: authorToFollow }).getList();
    const myFollow = existingFollows.find(f => f.username === currentUser.username);

    if (myFollow) {
        await room.collection('follow').delete(myFollow.id);
    } else {
        await room.collection('follow').create({ following: authorToFollow });
    }

    playSound('click');
}

// --- POST DETAIL VIEW ---

function showPostDetailView(postId) {
    activePostId = postId;
    updatePostDetailView(postId);
    showModal(postDetailModal);
}

function hidePostDetailModal() {
    activePostId = null;
    hideModal(postDetailModal);
}

async function updatePostDetailView(postId) {
    const post = room.collection('post').getList().find(p => p.id === postId);
    if (!post) return;

    const currentUser = await window.websim.getCurrentUser();
    const allFollows = room.collection('follow').filter({ following: post.author }).getList();
    const isFollowing = allFollows.some(f => f.username === currentUser.username);
    
    const allLikes = room.collection('like').filter({ post_id: postId }).getList();
    const isLiked = allLikes.some(l => l.username === currentUser.username);
    
    const allComments = room.collection('comment').filter({ post_id: postId }).getList().reverse();

    const modalContent = document.getElementById('post-detail-content');
    const commentsList = document.getElementById('post-detail-comments-list');

    modalContent.innerHTML = `
        <div class="post-header">
            <img src="https://images.websim.com/avatar/${post.author}" class="post-avatar">
            <div class="post-author-info">
                <span class="post-author">${post.author}</span>
                <span class="post-timestamp">${new Date(post.timestamp).toLocaleString()}</span>
            </div>
            <button class="post-options-btn">...</button>
            <div class="post-options-dropdown" style="display: none;">
                <button class="translate-post-btn" data-post-id="${post.id}">Translate</button>
                <button class="report-post-btn" data-post-id="${post.id}">Report</button>
            </div>
            ${post.author !== currentUser.username ? `<button class="follow-btn ${isFollowing ? 'following' : ''}" data-author="${post.author}">${isFollowing ? 'Unfollow' : 'Follow'}</button>` : ''}
        </div>
        <h2 class="post-title">${post.title}</h2>
        ${post.image ? `<img src="${post.image}" class="post-image-full">` : ''}
        <div class="post-content">${post.content}</div>
        <div class="post-interactions">
            <button class="like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">❤️ <span class="like-count">${allLikes.length}</span></button>
            <span>💬 ${allComments.length} Comments</span>
        </div>
    `;

    commentsList.innerHTML = '';
    allComments.forEach(comment => {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment-item';
        commentEl.innerHTML = `
            <img src="https://images.websim.com/avatar/${comment.username}" class="comment-avatar">
            <div class="comment-content">
                <span class="comment-author">${comment.username}</span>
                <p class="comment-text">${comment.text}</p>
            </div>
        `;
        commentsList.appendChild(commentEl);
    });
}

async function handleAddComment() {
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text || !activePostId) return;

    await room.collection('comment').create({
        post_id: activePostId,
        text
    });

    input.value = '';
}

function handlePostDetailInteraction(e){
    const target = e.target;
    const authorBtn = target.closest('.follow-btn');
    const likeBtn = target.closest('.like-btn');
    const optionsBtn = target.closest('.post-options-btn');
    const reportBtn = target.closest('.report-post-btn');
    const translateBtn = target.closest('.translate-post-btn');
    const postId = activePostId;

    if(authorBtn){
        handleFollow(authorBtn.dataset.author);
    }
    if(likeBtn){
        handleLike(likeBtn.dataset.postId);
    }
    if (optionsBtn) {
        togglePostOptionsMenu(postId, '#post-detail-content');
    }
    if (reportBtn) {
        startReportPost(postId);
    }
    if (translateBtn) {
        translatePost(postId);
    }
}

// --- NOTIFICATIONS ---

async function showNotifications() {
    const list = document.getElementById('notifications-list');
    list.innerHTML = '';
    
    const currentUser = await window.websim.getCurrentUser();
    const myFollows = room.collection('follow').getList().filter(f => f.username === currentUser.username);
    const followedUsernames = myFollows.map(f => f.following);

    if (followedUsernames.length === 0) {
        list.innerHTML = `<div class="no-posts-message">You don't follow anyone yet.</div>`;
        showModal(notificationsModal);
        return;
    }

    const allPosts = room.collection('post').getList();
    const feed = allPosts.filter(p => followedUsernames.includes(p.author));

    if (feed.length === 0) {
         list.innerHTML = `<div class="no-posts-message">No new posts from the people you follow.</div>`;
    } else {
        const postElements = await Promise.all(feed.map(post => createPostElement(post)));
        postElements.forEach(postEl => {
            if (postEl) list.appendChild(postEl);
        });
    }

    showModal(notificationsModal);
}

// --- SEARCH ---

async function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
        await renderFeed();
        return;
    }
    const allPosts = room.collection('post').getList();
    const filtered = allPosts.filter(p => p.title.toLowerCase().includes(query));
    await renderFeed(filtered);
}

// --- REPORT SYSTEM ---

function startReportPost(postId) {
    reportingPostId = postId;
    document.getElementById('report-reason-input').value = '';
    showModal(reportModal);
    document.querySelectorAll('.post-options-dropdown').forEach(el => el.style.display = 'none');
}

async function handleSubmitReport() {
    const reason = document.getElementById('report-reason-input').value.trim();
    if (!reason) {
        alert('Please describe the issue.');
        return;
    }

    const post = room.collection('post').getList().find(p => p.id === reportingPostId);
    if (!post) return;

    await room.collection('report').create({
        post_id: reportingPostId,
        post_title: post.title,
        post_author: post.author,
        reason
    });

    hideModal(reportModal);
    alert('Report submitted successfully.');
}

async function showReportsViewer() {
    const reportsList = document.getElementById('reports-list');
    reportsList.innerHTML = '';

    const allReports = room.collection('report').getList();

    if (allReports.length === 0) {
        reportsList.innerHTML = '<div class="no-reports-message">No reports to review.</div>';
    } else {
        for (const report of allReports) {
            const post = room.collection('post').getList().find(p => p.id === report.post_id);
            
            const reportEl = document.createElement('div');
            reportEl.className = 'report-item';
            reportEl.dataset.reportId = report.id;
            reportEl.innerHTML = `
                <div class="report-item-header">
                    <div class="report-item-info">
                        <img src="https://images.websim.com/avatar/${report.username}" class="report-item-avatar">
                        <div>
                            <div class="report-item-author">Reported by: ${report.username}</div>
                            <div class="report-item-timestamp">${new Date(report.created_at).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div class="report-reason"><strong>Reason:</strong> ${report.reason}</div>
                ${post ? `
                <div class="reported-post-preview">
                    <h4>${post.title}</h4>
                    <p><strong>By:</strong> ${post.author}</p>
                    ${post.image ? `<img src="${post.image}" style="max-width: 200px; border-radius: 5px; margin-top: 0.5rem;">` : ''}
                    <div style="margin-top: 0.5rem; color: #ccc;">${new DOMParser().parseFromString(post.content, 'text/html').body.textContent.substring(0, 150)}...</div>
                </div>
                <div class="report-actions">
                    <button class="delete-post-btn" data-post-id="${report.post_id}" data-report-id="${report.id}">Delete Post</button>
                    <button class="dismiss-report-btn" data-report-id="${report.id}">Dismiss Report</button>
                </div>
                ` : '<p style="color: #888;">Post has been deleted</p>'}
            `;
            reportsList.appendChild(reportEl);
        }

        reportsList.querySelectorAll('.delete-post-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const postId = btn.dataset.postId;
                const reportId = btn.dataset.reportId;
                deleteReportedPost(postId, reportId);
            });
        });

        reportsList.querySelectorAll('.dismiss-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const reportId = btn.dataset.reportId;
                dismissReport(reportId);
            });
        });
    }

    showModal(reportsViewerModal);
}

async function deleteReportedPost(postId, reportId) {
    await room.collection('post').delete(postId);
    await dismissReport(reportId);
    alert('Post deleted successfully.');
}

async function dismissReport(reportId) {
    await room.collection('report').delete(reportId);
    showReportsViewer();
}

async function updateReportsBadge() {
    const currentUser = await window.websim.getCurrentUser();
    const creator = await window.websim.getCreatedBy();
    
    let existingBadge = notificationsBtn.querySelector('.reports-badge');
    
    if (currentUser.username === creator.username) {
        const allReports = room.collection('report').getList();
        if (allReports.length > 0) {
            if (!existingBadge) {
                existingBadge = document.createElement('span');
                existingBadge.className = 'reports-badge';
                notificationsBtn.style.position = 'relative';
                notificationsBtn.appendChild(existingBadge);
            }
            existingBadge.textContent = allReports.length;
        } else if (existingBadge) {
            existingBadge.remove();
        }
    }
}

async function updateFollowButtons() {
    // Refresh all follow button states
    await renderFeed();
    if (activePostId) {
        await updatePostDetailView(activePostId);
    }
}

// --- UTILITY ---

async function createPostElement(post) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    postCard.dataset.postId = post.id;
    postCard.dataset.author = post.author;

    const currentUser = await window.websim.getCurrentUser();
    const allFollows = room.collection('follow').filter({ following: post.author }).getList();
    const isFollowing = allFollows.some(f => f.username === currentUser.username);
    
    const allLikes = room.collection('like').filter({ post_id: post.id }).getList();
    const isLiked = allLikes.some(l => l.username === currentUser.username);
    
    const allComments = room.collection('comment').filter({ post_id: post.id }).getList();

    // Removed textContent stripping to preserve HTML styles in preview.
    // CSS will now handle the truncation visually.

    postCard.innerHTML = `
        <div class="post-header">
            <img src="https://images.websim.com/avatar/${post.author}" class="post-avatar">
            <div class="post-author-info">
                <span class="post-author">${post.author}</span>
                <span class="post-timestamp">${new Date(post.timestamp).toLocaleString()}</span>
            </div>
            <button class="post-options-btn">...</button>
            <div class="post-options-dropdown" style="display: none;">
                <button class="translate-post-btn">Translate</button>
                <button class="report-post-btn">Report</button>
            </div>
            ${post.author !== currentUser.username ? `<button class="follow-btn ${isFollowing ? 'following' : ''}">${isFollowing ? 'Unfollow' : 'Follow'}</button>` : ''}
        </div>
        <h3 class="post-title-preview">${post.title}</h3>
        ${post.image ? `<img src="${post.image}" class="post-image-preview">` : ''}
        <div class="post-content-preview">${post.content}</div>
        <div class="post-interactions">
            <button class="like-btn ${isLiked ? 'liked' : ''}">❤️ <span class="like-count">${allLikes.length}</span></button>
            <span class="comment-count">💬 ${allComments.length}</span>
        </div>
    `;
    return postCard;
}

function togglePostOptionsMenu(postId, contextSelector = '') {
    document.querySelectorAll(`${contextSelector} .post-options-dropdown, .post-card .post-options-dropdown`).forEach(el => {
        const parentPost = el.closest('.post-card, #post-detail-content');
        if (parentPost && parentPost.dataset.postId !== postId) {
             el.style.display = 'none';
        }
    });

    const postElement = document.querySelector(`${contextSelector} [data-post-id="${postId}"], .post-card[data-post-id="${postId}"]`);
    if(postElement) {
        const dropdown = postElement.querySelector('.post-options-dropdown');
        if(dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    }
}

async function translatePost(postId) {
    const post = room.collection('post').getList().find(p => p.id === postId);
    if (!post) return;

    const postElement = document.querySelector(`.post-card[data-post-id="${postId}"], #post-detail-content`);
    const translateButton = postElement.querySelector('.translate-post-btn');
    if(translateButton) translateButton.textContent = 'Translating...';

    try {
        const completion = await websim.chat.completions.create({
            messages: [
                { role: 'system', content: `Translate the following JSON content to ${currentLanguage}. Return only the translated JSON.`},
                { role: 'user', content: JSON.stringify({ title: post.title, content: new DOMParser().parseFromString(post.content, 'text/html').body.textContent }) },
            ],
            json: true,
        });
        const translated = JSON.parse(completion.content);

        await room.collection('post').update(post.id, {
            title: translated.title,
            content: `<p>${translated.content}</p>`
        });

    } catch (error) {
        console.error("Translation failed", error);
        if(translateButton) translateButton.textContent = 'Translate';
        alert('Translation failed.');
    } finally {
         document.querySelectorAll('.post-options-dropdown').forEach(el => el.style.display = 'none');
    }
}

// --- BOT SIMULATION ---

async function runCommunitySimulation() {
    const bots = participants.filter(p => p.role !== 'Admin');
    if (bots.length === 0) return;
    const bot = bots[Math.floor(Math.random() * bots.length)];

    const action = Math.random();

    try {
        if (action < 0.15) {
            const completion = await websim.chat.completions.create({
                messages: [
                    { role: 'system', content: `You are '${bot.name}', a person with this personality: ${bot.personality}. Generate a short, interesting post for a social media feed in ${currentLanguage}. Respond in JSON with "title" and "content" fields.`},
                    { role: 'user', content: `Create a post in ${currentLanguage}.`}
                ],
                json: true
            });
            const postData = JSON.parse(completion.content);

            let imageUrl = null;
            if (Math.random() < 0.3) {
                const imgResult = await websim.imageGen({ prompt: postData.title, aspect_ratio: "16:9" });
                imageUrl = imgResult.url;
            }

            await room.collection('post').create({
                author: bot.name,
                title: postData.title,
                content: `<p>${postData.content}</p>`,
                image: imageUrl,
                timestamp: Date.now()
            });

        } else if (action < 0.6) {
            const allPosts = room.collection('post').getList();
            if (allPosts.length > 0) {
                const postToComment = allPosts[Math.floor(Math.random() * allPosts.length)];
                const completion = await websim.chat.completions.create({
                    messages: [
                        { role: 'system', content: `You are '${bot.name}' (${bot.personality}). Write a short, realistic comment in ${currentLanguage} on this post. Be casual.`},
                        { role: 'user', content: `Post by ${postToComment.author}: "${postToComment.title}"` }
                    ]
                });
                
                await room.collection('comment').create({
                    post_id: postToComment.id,
                    text: completion.content,
                    author: bot.name
                });
            }

        } else if (action < 0.85) {
            const allPosts = room.collection('post').getList();
            if (allPosts.length > 0) {
                const postToLike = allPosts[Math.floor(Math.random() * allPosts.length)];
                const existingLikes = room.collection('like').filter({ post_id: postToLike.id }).getList();
                const alreadyLiked = existingLikes.some(l => l.username === bot.name);
                
                if (!alreadyLiked) {
                    await room.collection('like').create({
                        post_id: postToLike.id,
                        author: bot.name
                    });
                }
            }
        } else {
            const userToFollow = participants[Math.floor(Math.random() * participants.length)];
            if (userToFollow.name !== bot.name) {
                const existingFollows = room.collection('follow').filter({ following: userToFollow.name }).getList();
                const alreadyFollowing = existingFollows.some(f => f.username === bot.name);
                
                if (!alreadyFollowing) {
                    await room.collection('follow').create({
                        following: userToFollow.name,
                        follower: bot.name
                    });
                }
            }
        }
    } catch (error) {
        console.error("Bot community simulation failed:", error);
    }
}