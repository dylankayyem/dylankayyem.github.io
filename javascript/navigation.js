/* navigation.js */

function loadNavigationBar() {
    document.getElementById("nav-placeholder").innerHTML = `
    <div class="topnav" id="myTopnav">
        <a href="index.html" class="active">Home</a>
        <a href="html/news.html">News</a>
        <a href="html/contact.html">Contact</a>
        <a href="html/about.html">About</a>
        <a href="javascript:void(0);" class="icon" onclick="myFunction()">
          <i class="fa fa-bars"></i>
        </a>
    </div>
    <script>
      function myFunction() {
        var x = document.getElementById("myTopnav");
        if (x.className === "topnav") {
          x.className += " responsive";
        } else {
          x.className = "topnav";
        }
      }
    </script>
    `;
}
