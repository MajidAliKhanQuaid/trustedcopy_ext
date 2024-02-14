// const host = "https://trusted-copy-7ao3.vercel.app";
const BANK_STATEMENT = 0;
const UTILITY_BILLS = 1;
const PAY_STUB = 2;
const DEGREE_TRANSCRIPT = 3;
const W2_TAX_RETURN = 4;

const apiHost = "https://localhost:44351";
let documentSaveUrl = `${apiHost}/api/document/save`;
let pendingUrl = `${apiHost}/api/document/requests/pending`;

const frontendHost = "http://localhost:3000";
const signInUrl = `${frontendHost}/login`;
const vaultUrl = `${frontendHost}/document/requests`;
// document.addEventListener("DOMContentLoaded", async () => {
//   console.log("FROM PAGE ", fromPageLocalStore);
//   try {
//     const key = "user";

//     // Get the current tab
//     const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
//     const tab = tabs[0];

//     // Execute script in the current tab
//     const fromPageLocalStore = await chrome.tabs.executeScript(tab.id, {
//       code: `localStorage['${key}']`,
//     });

//     console.log("FROM PAGE ", fromPageLocalStore);

//     // Store the result
//     // await chrome.storage.local.set({ [key]: fromPageLocalStore[0] });
//   } catch (err) {
//     // Log exceptions
//   }
// });

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

function getDocumentTypes(_types) {
  return _types.map(function (t) {
    return getDocumentType(t);
  });
}

function getDocumentType(_type) {
  if (_type == BANK_STATEMENT) {
    return "Bank Statement";
  } else if (_type == UTILITY_BILLS) {
    return "Utility Bills";
  } else if (_type == PAY_STUB) {
    return "Pay Stub";
  } else if (_type == DEGREE_TRANSCRIPT) {
    return "Degree Transcript";
  } else if (_type == W2_TAX_RETURN) {
    return "W2 Tax Return";
  }
  return null;
}

async function getPendingRequests(_token) {
  try {
    const response = await fetch(pendingUrl, {
      headers: {
        Authorization: `Bearer ${_token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    console.log("[PopUp] Pending Requests : ", data); // Handle the data received from the server
    return data;
  } catch (error) {
    console.error(
      "[PopUp] There was a problem with the fetch operation:",
      error
    );
  }
}

jQuery(async function () {
  // let user = localStorage.getItem("user");
  let user = await chrome.storage.local.get(["user"]);
  if (user) {
    console.log("[Popup] | USER FOUND ", user);
    try {
      let userInfo = JSON.parse(user.user);
      let isLoggedIn = userInfo;
      console.log("[Popup] Is Logged In ", isLoggedIn);
      if (isLoggedIn) {
        let pendingRequests = await getPendingRequests(userInfo.access_token);
        console.log("[Popup] ** Pending Request ", pendingRequests);
        let lstRequests = pendingRequests.map(function (req) {
          return `<div style="border: solid 1px black; padding: 5px; margin: 2px;">
          <div><a href="">${req.code}</a></div>
          <div>${getDocumentTypes(req.type)}</div>
          </div>`;
        });
        lstRequests.join("");

        // let lstOptions = pendingRequests.map(function (req) {
        //   return `<option value="${req.id}">${req.code}</option>`;
        // });
        // let options = lstOptions.join("");
        // let select = `<select>${options}</select>`;
        $(".tc-login-screen").removeClass("d-flex").addClass("d-none");
        $(".tc-docs-screen").removeClass("d-none").addClass("d-flex");
        $(".tc-pending-requests").html(lstRequests.join(""));
      } else {
        $(".tc-login-screen").removeClass("d-none").addClass("d-flex");
        $(".tc-docs-screen").removeClass("d-flex").addClass("d-none");
        $(".tc-pending-requests").html("");
      }
    } catch (err) {
      console.log("[Popup] | There was an Error ", err);
    }
  } else {
    console.log("[Popup] | USER NOT FOUND ");
  }

  // Create a new Date object for the current date and time
  var currentDate = new Date();

  // Subtract 1 hour
  currentDate.setHours(currentDate.getHours() - 1);
  let isoDate = currentDate.toISOString();

  // chrome.downloads.search(
  //   { limit: 1, state: "complete", endedAfter: isoDate },
  //   function (data) {
  //     console.log("DOWNLOAD ", data);

  //     data.forEach(function (item, i) {
  //       const reader = new FileReader();
  //       reader.onload = function (event) {
  //         const fileContents = event.target.result;
  //         console.log("RESULTS ARE ", fileContents);
  //       };

  //       reader.readAsText(item.filename);
  //       //
  //       var lastBackslashIndex = item.filename.lastIndexOf("\\");
  //       var fileName = item.filename.substring(lastBackslashIndex + 1);
  //       $(".file-container").append(`<div class="downloaded_file">
  //         <div>${fileName}</div>
  //         <button class="btnSaveToVault" doc="${item.id}">Save to Trusted Copy</button>
  //       </div>`);
  //     });
  //   }
  // );

  $(document).on("click", ".btnSaveToVault", function () {
    let doc = $(this).attr("doc");
    alert("DOCUMENT " + doc);
  });

  $(document).on("click", ".btnShowVault", function () {
    chrome.tabs.create({ url: vaultUrl });
  });

  $(document).on("click", ".btnSignUp", function () {
    $(".tc-login-screen").removeClass("d-flex").addClass("d-none");
    $(".tc-docs-screen").removeClass("d-none").addClass("d-flex");
  });

  $(document).on("click", ".lnk_SignIn", function () {
    chrome.tabs.create({ url: signInUrl });
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
