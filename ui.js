import { gsap } from 'gsap';
import { stopChatSimulation, scheduleNextBotMessage } from './bot.js';

export function showModal(modalElement) {
    modalElement.style.display = 'flex';
    setTimeout(() => {
        modalElement.style.opacity = '1';
        modalElement.style.pointerEvents = 'auto';
        const modalContent = modalElement.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.transform = 'scale(1)';
        }
    }, 10);
}

export function hideModal(modalElement) {
    modalElement.style.opacity = '0';
    modalElement.style.pointerEvents = 'none';
    const modalContent = modalElement.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.transform = 'scale(0.95)';
    }
    setTimeout(() => {
        modalElement.style.display = 'none';
    }, 300);
}


function screenTransition(onMiddle) {
    const transitionOverlay = document.getElementById('transition-overlay');
    const tl = gsap.timeline({
        onComplete: () => {
            gsap.set(transitionOverlay, { clearProps: 'clipPath' });
        }
    });

    gsap.set(transitionOverlay, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)' });

    tl.to(transitionOverlay, {
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
        duration: 0.6,
        ease: 'power2.inOut',
        onComplete: onMiddle
    })
    .to(transitionOverlay, {
        clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)',
        duration: 0.6,
        ease: 'power2.inOut'
    }, ">+0.1");
}

export function fadeInMenu(menuElement) {
    menuElement.style.display = 'flex';
    gsap.set(menuElement.querySelector('.menu-title'), { opacity: 0, y: 30 });
    gsap.set(menuElement.querySelectorAll('.menu-button'), { opacity: 0, y: 30 });

    gsap.to(menuElement, {
        opacity: 1,
        pointerEvents: 'auto',
        duration: 0.3,
        delay: 0.1
    });

    const title = menuElement.querySelector('.menu-title');
    const buttons = menuElement.querySelectorAll('.menu-button');
    gsap.to([title, ...buttons], {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power2.out',
        delay: 0.2
    });
}

export function switchMenu(fromMenu, toMenu, useTransition = false, onShowToMenu, onHideFromMenu) {
    const fromElements = fromMenu.id === 'chat-screen' 
        ? fromMenu.querySelectorAll('.chat-layout > *')
        : fromMenu.id === 'community-screen'
        ? [fromMenu.querySelector('.community-header'), fromMenu.querySelector('.community-feed')]
        : [fromMenu.querySelector('.menu-title'), ...fromMenu.querySelectorAll('.menu-button'), fromMenu.querySelector('.settings-container')];

    gsap.to(fromElements, {
        opacity: 0,
        y: -30,
        duration: 0.3,
        stagger: 0.05,
        onComplete: () => {
            fromMenu.style.display = 'none';
            fromMenu.style.pointerEvents = 'none';
            gsap.set(fromElements, {clearProps: 'all'});

            if (fromMenu.id === 'chat-screen') {
                stopChatSimulation();
            }
            if (onHideFromMenu) onHideFromMenu();

            toMenu.style.display = 'flex';
            gsap.set(toMenu, { opacity: 0, pointerEvents: 'none' });

            const toElements = toMenu.id === 'chat-screen'
                ? toMenu.querySelectorAll('.chat-layout > *')
                 : toMenu.id === 'community-screen'
                ? [toMenu.querySelector('.community-header'), toMenu.querySelector('.community-feed')]
                : [toMenu.querySelector('.menu-title'), ...toMenu.querySelectorAll('.menu-button'), toMenu.querySelector('.settings-container')];

            gsap.set(toElements, { opacity: 0, y: 30 });

            const fadeIn = () => {
                gsap.to(toMenu, {
                    opacity: 1,
                    pointerEvents: 'auto',
                    duration: 0.5,
                });
                gsap.to(toElements, {
                    opacity: 1,
                    y: 0,
                    duration: 0.7,
                    stagger: 0.1,
                    ease: 'power2.out',
                    delay: 0.2
                });

                if (toMenu.id === 'chat-screen') {
                    scheduleNextBotMessage();
                }
                 if (onShowToMenu) onShowToMenu();
            };

            if (useTransition) {
                screenTransition(fadeIn);
            } else {
                fadeIn();
            }
        }
    });
}