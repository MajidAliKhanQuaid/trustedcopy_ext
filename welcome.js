jQuery(function () {
  $(document).on("click", ".btnSignUp", function () {
    chrome.windows.create(
      { url: "popup.html", type: "popup" },
      function (window) {}
    );
  });
});
