function loadNavigationBar() {
    document.getElementById("nav-placeholder").innerHTML = `
    <div class="topnav" id="myTopnav">
      <a href="my-work.html">Portfolio</a>
      <a href="about.html">Contact</a>
      <a href="index.html" class="active">About</a>
      <a href="javascript:void(0);" class="icon" onclick="myFunction()"><i class="fa fa-bars"></i></a>
    </div>
    `;
}

function myFunction() {

  var x = document.getElementById("myTopnav");

  if (x.className === "topnav") {
    x.className += " responsive";
    
  } else {
    x.className = "topnav";
  }
}