import axios from 'axios';
import { $ } from './bling';

function ajaxHeart(e) {
  e.preventDefault();
  // grab the dynamic action off the form element
  axios
    .post(this.action)
    .then(res => {
      // can access child elements with name property on this obj
      // update button color....this.heart = button
      const isHearted = this.heart.classList.toggle('heart__button--hearted');

      // update heart counter
      $('.heart-count').textContent = res.data.hearts.length;

      // add animation
      if (isHearted) {
        this.heart.classList.add('heart__button--float');
        // arrow fn so will keep access to this obj
        setTimeout(() => this.heart.classList.remove('heart__button--float'), 2500);
      }
    })
    .catch(console.error);
}

export default ajaxHeart;
