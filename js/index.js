(function ($) {
	const SUPPORTED_VERSIONS = [ 8 ];
	let contractVersion = -1;
	let startTime = -1;
	let account = localStorage.getItem("account") || "";
	let chainId = localStorage.getItem("chainId") || null;
	const canConnect = typeof window.ethereum !== "undefined";

	let presaleAddress = new URLSearchParams(window.location.search).get("presale");

	if (presaleAddress) {
		loadPresaleData(presaleAddress);
		$("#presaleAddress").val(presaleAddress);
	}

	const checkConnection = async () => {
		// Reload on
		window.ethereum.on('chainChanged', (_chainId) => window.location.reload());

		if (account && chainId !== null) {
			$("#connectBtn").hide();
			$("#address").text(account);
			$("#purchaseBtn").show();
		} else {
			$("#address").text("");
		}

		window.ethereum.on('accountsChanged', function (accounts) {
			console.log("account changed");
			disconnectAccount();
		});

		loadBlocks();
	};
	checkConnection();
	$("#connectBtn").click(connectAccount);

	async function connectAccount() {
		if (canConnect) {
			console.log("Connecting via web3");
			try {
				const web3 = new window.Web3(window.ethereum);
				
				web3.currentProvider.on("disconnect", function () {
					disconnectAccount();
				});
				chainId = await web3.eth.getChainId();
				if (chainId !== 56 && chainId !== 97 && chainId !== 1337) {
					window.ethereum.request({
						method: 'wallet_addEthereumChain',
						params: [{
							chainId: '0x38',
							chainName: 'Binance Smart Chain',
							nativeCurrency: {
								name: 'BNB',
								symbol: 'BNB',
								decimals: 18
							},
							rpcUrls: ['https://bsc-dataseed.binance.org/'],
							blockExplorerUrls: ['https://bscscan.com/']
						}]
					});
				}
				const accounts = await web3.eth.requestAccounts();
				account = accounts[0];
				localStorage.setItem("account", account);
				localStorage.setItem("chainId", chainId);
				console.log(account + " connected.");

				$("#address").text(account);
				$("#connectBtn").hide();
				$("#purchaseBtn").show();
			} catch (err) {
				console.log("Failed to connect via web3");
				disconnectAccount();
			}
		}
	}

	function disconnectAccount() {
		console.log("disconnected");
		account = "";
		chainId = null;
		localStorage.removeItem("account");
		localStorage.removeItem("chainId");
		$("#connectBtn").show();
		$("#purchaseBtn").hide();
		$("#address").text("");
	}

	async function loadPresaleData(presaleAddress) {
		$("#error, #presale-form").hide();
		$(".spinner").show();

		try {
			const web3 = new window.Web3(window.ethereum);
			let presaleContract = new web3.eth.Contract(contractVersionABI, presaleAddress);

			contractVersion = parseInt(await presaleContract.methods.version().call());
			console.log(contractVersion);

			if (SUPPORTED_VERSIONS.indexOf(contractVersion) < 0) {
				showError(`Unsupported Pinksale Version ${contractVersion}, may not act as expected`);
				presaleContract = new web3.eth.Contract(presaleABIs[Math.max(...SUPPORTED_VERSIONS)], presaleAddress);
			} else {
				presaleContract = new web3.eth.Contract(presaleABIs[contractVersion], presaleAddress);
			}

			const max = web3.utils.fromWei(await presaleContract.methods.maxContribution().call());
			const min = web3.utils.fromWei(await presaleContract.methods.minContribution().call());
			const softcap = web3.utils.fromWei(await presaleContract.methods.softCap().call());
			const hardcap = web3.utils.fromWei(await presaleContract.methods.hardCap().call());
			console.log(max, min, softcap, hardcap);

			$("#maxbtn").off("click").on("click", () => $("#contribution").val(max));
			$("#minbtn").off("click").on("click", () => $("#contribution").val(min));
			$("#contribution").attr({
				max: max,
				min: min,
				step: 0.1
			}).val(max);
			$("#cap").text(`${softcap}/${hardcap}`);

			const address = await presaleContract.methods.token().call();

			const contract = new web3.eth.Contract(basicABI, address);
			const name = await contract.methods.name().call();
			const symbol = await contract.methods.symbol().call();
			console.log(name, symbol);

			startTime = await presaleContract.methods.startTime().call();
			const startDate = new Date(startTime * 1000);

			$("#presale-data").html(`
				<div class="form-row">
                <div class="form-group col-md-12">
                  <label for="tokenAddress">Token Address</label>
                  <a target="_blank" href="https://bscscan.com/address/${address}">${address}</a>
                </div>
				<div class="form-group col-md-12">
                  <label for="tokenAddress">Presale Address</label>
                  <a target="_blank" href="https://bscscan.com/address/${presaleAddress}">${presaleAddress}</a>
                </div>
                <div class="form-group col-md-4">
                  <label for="tokenName">Token Name</label>
                  <p>${name}</p>
                </div>
                <div class="form-group col-md-4">
                  <label for="tokenSymbol">Token Symbol</label>
                  <p>${symbol}</p>
                </div>
				<div class="form-group col-md-4">
				<label for="contractVersion">Pinksale Version</label>
					<p>${contractVersion}</p>
				</div>
				<div class="form-group col-md-3">
                  <label>Presale Unix Timestamp</label>
                  <p id="starttimestamp">${startTime}</p>
                </div>
				<div class="form-group col-md-3">
                  <label>Presale Start Date</label>
                  <p id="startdate">${startDate.toLocaleString()}</p>
                </div>
                <div class="form-group col-md-3">
                  <label>Estimated Start Block</label>
                  <p id="startblock"></p>
                </div>
				<div class="form-group col-md-3">
                  <label>Remaining Blocks</label>
                  <p id="remaining"></p>
                </div>
              </div>`);

			$("#presale-form").show();
		} catch (err) {
			console.log(err);
			showError(`Failed to load.<br>${err}<br>Supported Pinksale Versions: ${SUPPORTED_VERSIONS.join(", ")}`);
		}
		$(".spinner").hide();
	}

	$("#loadBtn").click(() => {
		presaleAddress = $("#presaleAddress").val();
		loadPresaleData(presaleAddress);
	});


	async function loadBlocks() {
		if (canConnect) {
			const web3 = new window.Web3(new Web3.providers.HttpProvider("https://bsc-dataseed.binance.org/"));
			const block = await web3.eth.getBlockNumber();
			$("#block").text(block).attr("href", `https://bscscan.com/block/${block}`);
			const currentBlock = await web3.eth.getBlock(block);
			const pastBlock = await web3.eth.getBlock(block - 500);
			const avg = (currentBlock.timestamp - pastBlock.timestamp) / 500.0;
			const time = new Date() / 1000;
			const diff = startTime - time;
			const start = Math.round(block + diff / avg);
			$("#startblock").text(start);
			$("#remaining").text(start - block);
			setTimeout(loadBlocks, 100);
		}
	}

	async function purchase() {
		$("#error").hide();
		try {
			const web3 = new window.Web3(window.ethereum);
			const presaleContract = new web3.eth.Contract(presaleABIs[contractVersion], presaleAddress);

			const contribution = $("#contribution").val();
			const wei = web3.utils.toWei(contribution, "ether");

			presaleContract.methods.contribute().send({
				from: account,
				value: wei
			}, function(err) {
				if (err) {
					showError(err.message);
				} else {
					alert("Well I think everything worked. Go check you got in or no.");
				}
			});
		} catch (err) {
			console.log(err);
			showError(err);
		}
	}

	function showError(err) {
		$("#error").html(`<h4 class='text-danger'>${err}</h4>`).show();
	}

	$("#purchaseBtn").click(purchase);
})(jQuery);