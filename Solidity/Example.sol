pragma solidity ^0.4.18;

import "./Ownable.sol";
import "./SafeMath.sol";
import "./ExampleToken.sol";

contract Crowdsale is Ownable {

    event StartICO();

    event StopICO();

    event NewWalletAddress(address _wallet);

    event NewReferalWallet(address _wallet);

    event NewCompanyWallet(address _wallet);

    event NewTeamWallet(address _wallet);

    event EtherRefunded(address _wallet, uint _value);

    using SafeMath for uint;

    /**
     * @dev The address to which the received ether will be sent
     */
    address public multisig;

    /**
     * @dev Referral pool, Registration pool, Login pool
     */
    address public referalWallet;

    /**
     * @div Team wallet
     */
    address public teamWallet;

    /**
     * @dev Company foundation
     */
    address public companyWallet;

    /**
     * @dev Advisors wallets
     */
    address[3] public advisorsList;

    /**
     * @dev Buyers whitelist
     */
    address[] public buyersList;

    struct buyer {
        bool state;
        uint etherSended;
        uint totalAmount;
        bool etherRefunded;
        address selfAddress;
    }

    /**
     * @dev Buyers statistic
     */
    mapping (address => buyer) public salesBook;

    /**
     * @dev ICO start date
     */
    uint public start;

    /**
     * @dev ICO duration
     */
    uint public ICODuration;

    /**
     * @dev ICO Period Number
     */
    uint public stageId;

    /**
     * @dev Number of tokens decimals
     */
    uint decimals;

    /**
     * @dev Limit of ether for the period of tier1
     */
    uint tier1Limit;

    /**
     * @dev Limit of ether for the period of tier2
     */
    uint tier2Limit;

    /**
     * @dev Limit of ether for the period of tier3
     */
    uint tier3Limit;

    /**
     * @dev Total ether needed
     */
    uint public hardCap;

    /**
     * @dev Minimal ether needed
     */
    uint public softCap;

    /**
     * @dev Cost of the token for the period of tier1
     */
    uint public tier1Rate;

    /**
     * @dev Cost of the token for the period of tier2
     */
    uint public tier2Rate;

    /**
     * @dev Cost of the token for the period of tier3
     */
    uint public tier3Rate;

    /**
     * @dev Number of sold tokens
     */
    uint public totalSold;

    /**
     * @dev Number of accumulated ether
     */
    uint public totalEtherAccumulated;

    /**
     * @dev Share of tokens reserved for the Referral pool, Registration pool, Login pool
     */
    uint referalPart;

    /**
     * @dev Share of tokens reserved for the Team
     */
    uint teamPart;

    /**
     * @dev Share of tokens reserved for the Company
     */
    uint companyPart;

    /**
     * @dev Share of tokens reserved for the Advisors
     */
    uint advisorsPart;

    /**
     * @dev ICO Status
     */
    bool public ICOState;

    /**
     * @dev Once call flag
     */
    bool startedOnce;

    /**
     * @dev Once send flag
     */
    bool reservesSended;

    /**
     * @dev Сould not collect the softCap flag
     */
    bool ICOFail;

    ExampleToken public token = new ExampleToken();

    /**
     * @dev Constructor function
     */
    function Crowdsale() public {

        referalPart = 20; // 20%
        teamPart = 64; // 6.4%
        companyPart = 60; // 60%
        advisorsPart = 12; // 1.2%

        tier1Rate = (uint)(1 ether).div(9000);
        tier2Rate = (uint)(1 ether).div(8000);
        tier3Rate = (uint)(1 ether).div(7000);

        ICODuration = 30 days;

        tier1Limit = 4000 ether;
        tier2Limit = 4500 ether;
        tier3Limit = 4000 ether;
        softCap = 4000 ether;
        hardCap = 12500 ether;
    }

    modifier saleIsOn() {
        uint today = now;
        require(ICOState && today >= start && today < start.add(ICODuration));
        _;
    }

    modifier saleIsOff() {
        require(!ICOState || now >= start.add(ICODuration));
        _;
    }

    modifier isUnderSoftCap() {
        if (startedOnce && (now >= start.add(ICODuration))) {
            if (totalEtherAccumulated >= softCap) {
                stopICO();
            } else {
                ICOFail = true;
                refundEther();
            }
        } else {
            _;
        }
    }

    modifier isUnderHardCap() {
        require(totalEtherAccumulated < hardCap);
        _;
    }

    modifier ifCanBuy() {
        require(
            salesBook[msg.sender].state && (msg.value >= (uint)(1 ether).div(10))
        );
        _;
    }

    /**
     * @dev Fallback function
     */
    function() external payable {
        require(msg.value > 0);
        sendTokens(msg.value, msg.sender);
    }

    /**
     * Send & freeze tokens for the participants wallets
     */
    function sendReserves() public onlyOwner {
        require(!reservesSended);
        reservesSended = true;
        uint totalBank = token.totalSupply();
        uint halfYear = (uint)(1 years).div(2);

        token.transfer(referalWallet, totalBank.mul(referalPart).div(100));
        token.transfer(companyWallet, totalBank.mul(companyPart).div(100));
        token.transfer(teamWallet, totalBank.mul(teamPart).div(1000));
        token.transfer(advisorsList[0], totalBank.mul(advisorsPart).div(1000));
        token.transfer(advisorsList[1], totalBank.mul(advisorsPart).div(1000));
        token.transfer(advisorsList[2], totalBank.mul(advisorsPart).div(1000));

        uint advisorsFreezePart = token.balanceOf(advisorsList[0]).div(4);
        token.addFreezePoint(advisorsList[0], start.add(halfYear), advisorsFreezePart);
        token.addFreezePoint(advisorsList[0], start.add(1 years), advisorsFreezePart);
        token.addFreezePoint(advisorsList[0], start.add(1 years).add(halfYear), advisorsFreezePart);

        token.addFreezePoint(advisorsList[1], start.add(halfYear), advisorsFreezePart);
        token.addFreezePoint(advisorsList[1], start.add(1 years), advisorsFreezePart);
        token.addFreezePoint(advisorsList[1], start.add(1 years).add(halfYear), advisorsFreezePart);

        token.addFreezePoint(advisorsList[2], start.add(halfYear), advisorsFreezePart);
        token.addFreezePoint(advisorsList[2], start.add(1 years), advisorsFreezePart);
        token.addFreezePoint(advisorsList[2], start.add(1 years).add(halfYear), advisorsFreezePart);

        uint companyFreezePart = token.balanceOf(companyWallet).div(4);
        token.addFreezePoint(companyWallet, start.add(1 years), companyFreezePart);
        token.addFreezePoint(companyWallet, start.add(1 years).add(halfYear), companyFreezePart);
        token.addFreezePoint(companyWallet, start.add(2 years), companyFreezePart);
        token.addFreezePoint(companyWallet, start.add(2 years).add(halfYear), companyFreezePart);
    }

    /**
     * @dev Starting ICO
     */
    function startICO() public onlyOwner returns(bool) {
        require(!startedOnce);
        startedOnce = true;
        ICOState = true;
        start = now;
        stageId = 0;
        StartICO();
        sendReserves();
        decimals = 10 ** uint256(token.decimals());
        token.pause();
        return true;
    }

    /**
     * @dev Turning off the ICO
     */
    function stopICO() saleIsOff onlyOwner public returns(bool) {
        checkICOState();
        StopICO();
        if (ICOFail) {
            refundEther();
        } else {
            multisig.transfer(this.balance);
            token.unpause();
            token.transfer(companyWallet, token.balanceOf(this));
        }
        return true;
    }

    /**
     * @dev Check & update ICO state
     */
    function checkICOState() public {
        if (now >= start.add(ICODuration)) {
            ICOState = false;
            if (totalEtherAccumulated < softCap) {
                ICOFail = true;
            }
        }
    }

    /**
     * @dev Unfreeze avaible tokens
     */
    function getMyTokens() saleIsOff public returns(bool) {
        return token.unfreezeAvailableTokens(msg.sender);
    }

    /**
     * @dev Send ether for buyers wallets
     */
    function refundEther() onlyOwner saleIsOff public returns(bool) {
        for (uint i = 0; i < buyersList.length; i++) {
            if (!salesBook[buyersList[i]].etherRefunded && salesBook[buyersList[i]].etherSended > 0) {
                EtherRefunded(buyersList[i], salesBook[buyersList[i]].etherSended);
                salesBook[buyersList[i]].etherRefunded = true;
                buyersList[i].transfer(salesBook[buyersList[i]].etherSended);
            }
        }
        return true;
    }

    /**
     * @dev Send ether for buyers wallet
     */
    function getMyEther() public returns(bool) {
        if (!ICOFail && now > start + ICODuration && totalEtherAccumulated < softCap) {
            ICOFail = true;
        }
        require(ICOFail);
        require(!salesBook[msg.sender].etherRefunded);
        require(salesBook[msg.sender].etherSended > 0);
        EtherRefunded(msg.sender, salesBook[msg.sender].etherSended);
        salesBook[msg.sender].etherRefunded = true;
        (msg.sender).transfer(salesBook[msg.sender].etherSended);
        return true;
    }

    /**
     * @dev Sending tokens to the recipient, based on the amount of ether that it sent
     * @param _etherValue uint Amount of sent ether
     * @param _to address The address which you want to transfer to
     */
    function sendTokens(uint _etherValue, address _to) isUnderSoftCap ifCanBuy isUnderHardCap saleIsOn public payable {
        uint tokens;
        uint limit;
        uint rate;
        (limit, rate) = getStageData(getStageId());

        uint value;
        uint stageEther;

        bool more = _etherValue > limit;
        value = more ? limit : _etherValue;

        totalEtherAccumulated = totalEtherAccumulated.add(value);
        tokens = value.div(rate).mul(decimals);

        totalSold = totalSold.add(tokens);
        salesBook[_to].etherSended = (salesBook[_to].etherSended).add(value);
        salesBook[_to].totalAmount = (salesBook[_to].totalAmount).add(tokens);

        if (more) {
            stageEther = _etherValue.sub(limit);
            if (stageId < 2) {
                stageId++;
                if (stageEther > 0) {
                    sendTokens(stageEther, _to);
                }
            } else {
                ICOState = false;
                _to.transfer(stageEther);
            }
        }

        token.transfer(_to, tokens);
    }

    /**
     * @dev Returns stage id
     */
    function getStageId() saleIsOn public returns(uint) {
        uint tempStageId;
        uint balance = totalEtherAccumulated;

        if (balance < tier1Limit) {
            tempStageId = 0;

        } else if (balance >= tier1Limit &&
        balance < tier1Limit + tier2Limit) {
            tempStageId = 1;

        } else {
            tempStageId = 2;
        }
        stageId = (stageId > tempStageId) ? stageId : tempStageId;
        return stageId;
    }

    /**
     * @dev Returns Limit of ether for the period and rate taking
     * into account the nubmer of accumulated ether
     * @param _stageId uint
     */
    function getStageData(uint _stageId) saleIsOn public constant returns(uint, uint) {
        uint tempLimit = 0;
        uint tempRate;

        if (_stageId == 0) {
            tempLimit = tier1Limit;
            tempRate = tier1Rate;

        } else if (_stageId == 1) {
            tempLimit = tier1Limit.add(tier2Limit);
            tempRate = tier2Rate;

        } else {
            tempLimit = tier1Limit.add(tier2Limit).add(tier3Limit);
            tempRate = tier3Rate;
        }
        tempLimit = tempLimit.sub(totalEtherAccumulated);
        return (tempLimit, tempRate);
    }

    /**
     * @dev Add buyer to whitelist
     * @param _buyer address
     */
    function addBuyer(address _buyer) onlyOwner public returns(bool) {
        require(!salesBook[_buyer].state);
        salesBook[_buyer].state = true;
        if (salesBook[_buyer].selfAddress == address(0)) {
            buyersList.push(_buyer);
            salesBook[_buyer].selfAddress = _buyer;
        }
        return true;
    }

    /**
     * @dev Remove buyer from whitelist
     * @param _buyer address
     */
    function delBuyer(address _buyer) onlyOwner public returns(bool) {
        salesBook[_buyer].state = false;
        return true;
    }

    /**
     * @dev View buyers whitelist
     */
    function showBuyers() public constant returns(address[]) {
        return buyersList;
    }

    function setAdvisors(address[3] _advisors) onlyOwner public returns(bool) {
        for (uint i; i < _advisors.length; i++) {
            require(_advisors[i] != address(0));
        }
        advisorsList = _advisors;
        return true;
    }

    /**
     * @dev Show advisors list
     */
    function showAdvisors() public constant returns(address[3]) {
        return advisorsList;
    }

    /**
     * FOR DEV ONLY
     * @dev Show contract balance
     */
    function contractBalance() public view returns(uint) {
        return this.balance;
    }

    /**
     * @dev Returns the number of freezed tokens in the buyer's wallet
     */
    function myFreezedBalance() public view returns(uint) {
        return token.freezedBalanceOf(msg.sender);
    }

    /**
     * @dev Returns the number of tokens in the buyer's wallet
     */
    function myBalance() public view returns(uint) {
        return token.balanceOf(msg.sender);
    }

    /**
     * @dev Returns number of supplied tokens
     */
    function tokensSupply() public view returns(uint) {
        return token.totalSupply();
    }

    /**
     * @dev Sets new multisig address to which the accumulated ether will be sent
     * @param _to address
     */
    function setMultisig(address _to) public onlyOwner returns(bool) {
        require(_to != address(0));
        multisig = _to;
        NewWalletAddress(_to);
        return true;
    }

    /**
     * @dev Sets new multisig address to which the accumulated ether will be sent
     * @param _referalWallet address
     */
    function setReferalWallet(address _referalWallet) public onlyOwner returns(bool) {
        require(_referalWallet != address(0));
        referalWallet = _referalWallet;
        NewReferalWallet(_referalWallet);
        return true;
    }

    /**
     * @dev Sets new multisig address to which the accumulated ether will be sent
     * @param _companyWallet address
     */
    function setCompanyWallet(address _companyWallet) public onlyOwner returns(bool) {
        require(_companyWallet != address(0));
        companyWallet = _companyWallet;
        NewCompanyWallet(_companyWallet);
        return true;
    }

    /**
     * @dev Sets new multisig address to which the accumulated ether will be sent
     * @param _teamWallet address
     */
    function setTeamWallet(address _teamWallet) public onlyOwner returns(bool) {
        require(_teamWallet != address(0));
        teamWallet = _teamWallet;
        NewTeamWallet(_teamWallet);
        return true;
    }
}
