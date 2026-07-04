function removeStaticCoachCard(){
  document.querySelectorAll("#view-dashboard .coach-card").forEach((card) => card.remove());
}

function init(){
  removeStaticCoachCard();
  setTimeout(removeStaticCoachCard, 250);
  setTimeout(removeStaticCoachCard, 900);
  window.addEventListener("focus", removeStaticCoachCard);
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
