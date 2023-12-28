// Listen for download events
chrome.downloads.onCreated.addListener(function (delta) {
  console.log("On CREATE ", delta);
});

chrome.downloads.onChanged.addListener(function (delta) {
  console.log("On CHANGE ", delta);
  if (delta.state && delta.state.current === "complete") {
    // Download completed
    console.log("Download completed: ", delta.id);

    // You can perform additional actions here, if needed
  }
});
