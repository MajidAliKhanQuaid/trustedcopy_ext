chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Message received in content script:", request.message);
  // Handle the message here
});

chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    console.log("Download started:", details.url);
  },
  { types: ["main_frame"], urls: ["<all_urls>"] }
);

jQuery(function () {
  let isLoggedIn = false;
  if (isLoggedIn) {
    $(".tc-login-screen").removeClass("d-flex").addClass("d-none");
    $(".tc-docs-screen").removeClass("d-none").addClass("d-flex");
  } else {
    $(".tc-login-screen").removeClass("d-none").addClass("d-flex");
    $(".tc-docs-screen").removeClass("d-flex").addClass("d-none");
  }

  // Create a new Date object for the current date and time
  var currentDate = new Date();

  // Subtract 1 hour
  currentDate.setHours(currentDate.getHours() - 1);
  let isoDate = currentDate.toISOString();

  chrome.downloads.search(
    { limit: 1, state: "complete", endedAfter: isoDate },
    function (data) {
      console.log("DOWNLOAD ", data);

      data.forEach(function (item, i) {
        const reader = new FileReader();
        reader.onload = function (event) {
          const fileContents = event.target.result;
          console.log("RESULTS ARE ", fileContents);
        };

        reader.readAsText(item.filename);
        //
        var lastBackslashIndex = item.filename.lastIndexOf("\\");
        var fileName = item.filename.substring(lastBackslashIndex + 1);
        $(".file-container").append(`<div class="downloaded_file">
          <div>${fileName}</div>
          <button class="btnSaveToVault" doc="${item.id}">Save to Trusted Copy</button>
        </div>`);
      });
    }
  );

  $(document).on("click", ".btnSaveToVault", function () {
    let doc = $(this).attr("doc");
    alert("DOCUMENT " + doc);
  });

  $(document).on("click", ".btnShowVault", function () {
    var vaultUrl = "https://trusted-copy-7ao3.vercel.app/";
    chrome.tabs.create({ url: vaultUrl });
  });

  $(document).on("click", ".btnSignUp", function () {
    $(".tc-login-screen").removeClass("d-flex").addClass("d-none");
    $(".tc-docs-screen").removeClass("d-none").addClass("d-flex");
  });

  $(document).on("click", ".lnk_SignIn", function () {
    var vaultUrl = "https://trusted-copy-7ao3.vercel.app/login";
    chrome.tabs.create({ url: vaultUrl });
  });

  $(document).on("click", ".btnDownloadFile", function () {
    let url = $(".txt_file_to_download").val();
    if (url) {
      // chrome.downloads.download({ url: url });
      chrome.downloads.download({ url: url }, function (downloadId) {
        console.log("Download initiated with ID:", downloadId);

        chrome.downloads.onChanged.addListener(function (delta) {
          if (
            delta.state &&
            delta.state.current === "complete" &&
            delta.id === downloadId
          ) {
            let downloadStr = localStorage.getItem("TC_DOWNLOADS");
            if (downloadStr) {
              let downloads = JSON.parse(downloadStr);
              if (downloads.indexOf(downloadId) == -1) {
                downloads.push(downloadId);
                localStorage.setItem("TC_DOWNLOADS", JSON.stringify(downloads));
                $.each(downloads, function (index, d) {
                  console.log("DOWNLOAD ", d);
                });
              }
            } else {
              let downloads = [];
              downloads.push(downloadId);
              localStorage.setItem("TC_DOWNLOADS", JSON.stringify(downloads));
            }

            console.log("DOWNLOAD Completed");
            // sending message to tab
            // chrome.tabs.query(
            //   { active: true, currentWindow: true },
            //   function (tabs) {
            //     var activeTab = tabs[0];
            //     chrome.tabs.sendMessage(activeTab.id, {
            //       message: downloadId,
            //     });
            //   }
            // );
          }
        });
      });
    }
  });
});

function getDownloadIds() {
  let downloadIds = localStorage.getItem("TC_DOWNLOADS");
  if (downloadIds) {
    return JSON.parse(downloadIds);
  }
  return [];
}
