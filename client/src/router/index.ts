import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('@/views/GameView.vue'),
    },
    {
      path: '/lobby',
      name: 'lobby',
      component: () => import('@/views/LobbyView.vue'),
    },
    {
      path: '/room',
      name: 'room',
      component: () => import('@/views/RoomView.vue'),
    },
  ],
})

export default router
