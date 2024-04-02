function loadNavigationBar() {
    document.getElementById("nav-placeholder").innerHTML = `
    <div class="topnav" id="myTopnav">

        <a href="index.html" class="active">Home</a>

        <a href="about.html">About Me</a>
        
        <a href="my-work.html">My Work</a>

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

