var db = require.main.require('./utils/databases');

function findChildBoards(parentBoard, next)
{
    getChildren(parentBoard, function(response)
    {
        var returnArr = parentBoard.concat(response);
        return next(returnArr);
    });

    function getChildren(boardID, innerCallback)
    {
        db.getForumConnection(function (err, connection)
        {
            connection.query({
                sql: "SELECT board_id, board_sub_board_to FROM forum_boards WHERE board_sub_board_to IN(?)",
                timeout: 30000,
                values: [boardID.join()]
            }, function (error, results)
            {
                connection.release();
                if (error)
                {
                    return innerCallback(true);
                }
                else
                {
                    var newIDs = [];
                    var returnArray = [];
                    for (var i = 0; i < results.length; i++)
                    {
                        newIDs.push(results[i].board_id);
                        returnArray.push(results[i].board_id);
                    }
                    if (results.length > 0)
                    {
                        getChildren(newIDs, function (response)
                        {
                            if (response === true)
                            {
                                return innerCallback(true);
                            }
                            else
                            {
                                returnArray = returnArray.concat(response);
                                return innerCallback(returnArray);
                            }
                        });
                    }
                    else
                    {
                        return innerCallback(returnArray);
                    }
                }
            });
        });
    }
}

module.exports = {
    findChildBoards: findChildBoards
}